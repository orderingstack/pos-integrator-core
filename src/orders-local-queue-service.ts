import { Database } from 'better-sqlite3';
import { IOrder } from '@orderingstack/ordering-types';
import { IOrderRecord, OrderRecordEditableParams } from './types';
import schedule, { Job } from 'node-schedule';
import { logger } from './logger';
import { orderService } from './orders-service';
const orderDao = require('./db/orders-dao');

const DB_ORDERS_RETENTION_DAYS = 30;
let db: Database;

let jobPurgeOldOrders: Job | null = null;
let jobProcessOrders: Job | null = null;
let jobStats: Job | null = null;
let processOrderCallbackFunction:
  | undefined
  | ((orderRecord: IOrderRecord) => Promise<void>) = (order: IOrderRecord) =>
  Promise.resolve();

async function addOrderToProcessingQueue(
  orderData: IOrder,
  {
    stage = 'NEW',
    isCreatedCentrally = 1,
    checkSeq,
    ...rest
  }: OrderRecordEditableParams = {},
) {
  const orderRec: Partial<IOrderRecord> = {
    ...rest,
    id: orderData.id,
    checkSeq,
    created: orderData.created,
    orderStatus: orderData.status || 'NEW',
    orderbody: JSON.stringify(orderData),
  };
  if (orderDao.isOrderInDb(db, orderData.id)) {
    orderDao.updateOrderBody(db, orderRec as IOrderRecord);
    return;
  }
  orderRec.stage = stage;
  orderRec.isCreatedCentrally = isCreatedCentrally;
  try {
    orderDao.upsertOrder(db, orderRec as IOrderRecord);
  } catch (ex) {
    logger.error(ex);
  }
}

async function pullOrdersAndAddToProcessingQueue(venue: string, token: string) {
  const orders = await orderService.pullOrders(venue, token);
  for (const order of orders) {
    addOrderToProcessingQueue(order);
  }
}

function initOrdersQueue({
  processOrderCallback,
  processOrderCronPattern = '*/2 * * * * *',
  statsCallback,
  statsCronPattern = '15 * * * * *',
}: {
  processOrderCallback?: (orderRecord: IOrderRecord) => Promise<void>;
  processOrderCronPattern?: string;
  statsCallback?: (stats: any) => void;
  statsCronPattern?: string;
}) {
  processOrderCallbackFunction = processOrderCallback;
  /* run every hour */
  jobPurgeOldOrders = schedule.scheduleJob('0 * * * *', function () {
    purgeOldOrders();
  });
  if (processOrderCallbackFunction) {
    jobProcessOrders = schedule.scheduleJob(
      `${processOrderCronPattern}`,
      function () {
        processOrdersFromDB();
      },
    );
  }
  if (statsCallback) {
    jobStats = schedule.scheduleJob(`${statsCronPattern}`, function () {
      generateStatsFromDB(statsCallback);
    });
  }
}

function stopOrdersQueue() {
  if (jobPurgeOldOrders) schedule.cancelJob(jobPurgeOldOrders);
  if (jobProcessOrders) schedule.cancelJob(jobProcessOrders);
  if (jobStats) schedule.cancelJob(jobStats);
}

function purgeOldOrders() {
  orderDao.removeOlderThan(db, DB_ORDERS_RETENTION_DAYS);
  orderDao.removeClosedOrdersOrAbandoned(db);
}

function processOrdersFromDB() {
  const orders = orderDao.getOrdersToProcess(db);
  for (const order of orders) {
    processOrderCallbackFunction?.(order);
  }
}

function processOrderInstantly(orderId: string) {
  setTimeout(() => {
    //orderDao.setOrderNextStageRunInSeconds(order.id, 3);
    const order = orderDao.getOrder(db, orderId);
    processOrderCallbackFunction?.(order);
  }, 100);
}

function generateStatsFromDB(statsCallback: (stats: any) => void) {
  const stats = orderDao.getStats(db);
  statsCallback(stats);
}

function setOrderStage(orderId: string, stage: string) {
  orderDao.setOrderStage(db, orderId, stage);
}

function setNextRunInSeconds(orderId: string, seconds: number) {
  orderDao.setNextRunInSeconds(db, orderId, seconds);
}

function updateOrderBody(orderRec: IOrderRecord) {
  orderDao.updateOrderBody(db, orderRec);
}

function isOrderWithCheckSeqInDb(checkSeq: string | undefined): boolean {
  return orderDao.isOrderWithCheckSeqInDb(db, checkSeq);
}

/**
 * updates orderRecord extraData
 * @param {string} orderId
 * @param {string} extraData
 */
function updateOrderExtraData(orderId: string, extraData: string) {
  orderDao.updateOrderExtraData(db, orderId, extraData);
}

function getOrder(orderId: string): IOrderRecord | undefined {
  return orderDao.getOrder(db, orderId);
}

function getOpenOrders(): IOrderRecord[] {
  return orderDao.getOpenOrders(db);
}

export function getOrdersQueue(dbFileName?: string) {
  if (dbFileName) {
    db = orderDao.createDatabase(dbFileName);
  } else {
    db = orderDao.createDatabase();
  }
  return {
    initOrdersQueue,
    stopOrdersQueue,
    addOrderToProcessingQueue,
    pullOrdersAndAddToProcessingQueue,
    setOrderStage,
    setNextRunInSeconds,
    updateOrderBody,
    updateOrderExtraData,
    getOrder,
    getOpenOrders,
    processOrderInstantly,
    isOrderWithCheckSeqInDb,
  };
}
