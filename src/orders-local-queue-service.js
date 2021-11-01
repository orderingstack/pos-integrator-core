const orderDao = require('./db/orders-dao');
const ordersService = require('./orders-service');
const schedule = require('node-schedule');

const DB_ORDERS_RETENTION_DAYS = 30;
let db = null;

let jobPurgeOldOrders = null;
let jobProcessOrderLocallyCallback = null;
let jobProcessOrderCentrallyCallback = null;
let jobStatsCallback = null;

async function addOrderToProcessingQueue(orderData, { processedLocally = 0, processedCentrally = null, isCreatedCentrally = 1 }={}) {
    const orderRec = {
        id: orderData.id,
        created: orderData.created,
        orderStatus: orderData.status || 'NEW',
        orderbody: JSON.stringify(orderData)
    }
    if (orderDao.isOrderInDb(db, orderRec.id)) {
        orderDao.updateOrderBody(db, orderRec);
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

function initOrdersQueue({ 
    processOrderLocallyCallback, 
    processLocallyCronPattern = '*/2 * * * * *', 
    processOrderCentrallyCallback,
    processCentrallyCronPattern = '*/3 * * * * *',
    statsCallback = null,
    statsCronPattern = '15 * * * * *',
 }) {
    /* run every hour */
    jobPurgeOldOrders = schedule.scheduleJob('0 * * * *', function () {
        purgeOldOrders();
    });
    if (processOrderLocallyCallback) {
        jobProcessOrderLocallyCallback = schedule.scheduleJob(`${processLocallyCronPattern}`, function () {
            locallyProcessOrdersFromDB(processOrderLocallyCallback);
        });
    }
    if (processOrderCentrallyCallback) {
        jobProcessOrderCentrallyCallback = schedule.scheduleJob(`${processCentrallyCronPattern}`, function () {
            centrallyProcessOrdersFromDB(processOrderCentrallyCallback);
        });
    }
    if (statsCallback) {
        jobStatsCallback = schedule.scheduleJob(`${statsCronPattern}`, function () {
            generateStatsFromDB(statsCallback);
        });
    }
}

function stopOrdersQueue() {
    if (jobPurgeOldOrders) schedule.cancelJob(jobPurgeOldOrders);
    if (jobProcessOrderLocallyCallback) schedule.cancelJob(jobProcessOrderLocallyCallback);
    if (jobProcessOrderCentrallyCallback) schedule.cancelJob(jobProcessOrderCentrallyCallback);
    if (jobStatsCallback) schedule.cancelJob(jobStatsCallback);
}

function purgeOldOrders() {
    orderDao.removeOlderThan(db, DB_ORDERS_RETENTION_DAYS);
    orderDao.removeClosedOrdersOrAbandoned(db);
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

function generateStatsFromDB(statsCallback) {    
    const stats = orderDao.getStats(db);
    statsCallback(stats);
}

function setOrderProcessedLocally(orderId, processed) {
    orderDao.setOrderProcessedLocally(db, orderId, processed);
}

function setOrderProcessedCentrally(orderId, processed) {
    orderDao.setOrderProcessedCentrally(db, orderId, processed);
}

function updateOrderBody(orderRec) {
    orderDao.updateOrderBody(db, orderRec);
}

function getOrder(orderId) {
    return orderDao.getOrder(db, orderId);
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
        updateOrderBody,
        getOrder
    }
    return module;
}

