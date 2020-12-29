const orderDao = require('./db/orders-dao');
const ordersService = require('./orders-service');
const schedule = require('node-schedule');

const DB_ORDERS_RETENTION_DAYS = 4;
let db = null;

let jobPurgeOldOrders = null;
let jobProcessOrderLocallyCallback = null;
let jobProcessOrderCentrallyCallback = null;

async function addOrderToProcessingQueue(orderData, { processedLocally = 0, processedCentrally = null, isCreatedCentrally = 1 }={}) {
    const orderRec = {
        id: orderData.id,
        created: orderData.created,
        orderbody: JSON.stringify(orderData)
    }
    if (orderDao.isOrderInDb(db, orderRec.id)) {
        //TODO: update order in db, make sure that processLocally/globally is not changes
        return;
    }
    orderRec.processedLocally = processedLocally;
    orderRec.processedCentrally = processedCentrally;
    orderRec.isCreatedCentrally = isCreatedCentrally;
    try {
        orderDao.upsertOrder(db, orderRec);
    } catch (ex) {
        console.error(ex);
    }
}

async function pullOrdersAndAddToProcessingQueue(venue, token) {
    const orders = await ordersService.pullOrders(venue, token);
    for (const order of orders) {
        addOrderToProcessingQueue(order);
    };
}

function initOrdersQueue({ processOrderLocallyCallback, processOrderCentrallyCallback, processLocallyInterval = 15, processCentrallyInterval = 30 }) {
    /* run every hour */
    jobPurgeOldOrders = schedule.scheduleJob('0 * * * *', function () {
        purgeOldOrders();
    });
    if (processOrderLocallyCallback) {
        jobProcessOrderLocallyCallback = schedule.scheduleJob(`*/${processLocallyInterval} * * * * *`, function () {
            locallyProcessOrdersFromDB(processOrderLocallyCallback);
        });
    }
    if (processOrderCentrallyCallback) {
        jobProcessOrderCentrallyCallback = schedule.scheduleJob(`*/${processCentrallyInterval} * * * * *`, function () {
            centrallyProcessOrdersFromDB(processOrderCentrallyCallback);
        });
    }
}

function stopOrdersQueue() {
    const r1 = schedule.cancelJob(jobPurgeOldOrders);
    const r2 = schedule.cancelJob(jobProcessOrderLocallyCallback);
    const r3 = schedule.cancelJob(jobProcessOrderCentrallyCallback);
    //console.log(`Canceling Orders queue jobs: ${r1} ${r2} ${r3}`);
}

function purgeOldOrders() {
    orderDao.removeOlderThan(db, DB_ORDERS_RETENTION_DAYS);
}

function locallyProcessOrdersFromDB(processOrderCallback) {
    const orders = orderDao.getOrdersNotYetLocallyProcessed(db);
    for (const order of orders) {
        processOrderCallback(order);
    };
}

function centrallyProcessOrdersFromDB(processOrderCallback) {
    const orders = orderDao.getOrdersNotYetCentrallyProcessed(db);
    for (const order of orders) {
        //do something with this order
        processOrderCallback(order);
    };
}

function setOrderProcessedLocally(orderId, processed) {
    orderDao.setOrderProcessedLocally(db, orderId, processed);
}

function setOrderProcessedCentrally(orderId, processed) {
    orderDao.setOrderProcessedCentrally(db, orderId, processed);
}

module.exports = function (dbFileName) {
    if (dbFileName) {
        db = orderDao.createDatabase(dbFileName);
    } else {
        db = orderDao.createDatabase();
    }
    const module = {
        initOrdersQueue,
        stopOrdersQueue,
        addOrderToProcessingQueue,
        pullOrdersAndAddToProcessingQueue,
        setOrderProcessedLocally,
        setOrderProcessedCentrally,
    }
    return module;
}

