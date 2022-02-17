const orderDao = require('./db/orders-dao');
const ordersService = require('./orders-service');
const schedule = require('node-schedule');

const DB_ORDERS_RETENTION_DAYS = 30;
let db = null;

let jobPurgeOldOrders = null;
let jobProcessOrders = null;
let jobStats = null;

async function addOrderToProcessingQueue(orderData, { stage = 'NEW' , isCreatedCentrally = 1 }={}) {
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
    orderRec.stage = stage;
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
    processOrderCallback, 
    processOrderCronPattern = '*/2 * * * * *', 
    statsCallback = null,
    statsCronPattern = '15 * * * * *',
 }) {
    /* run every hour */
    jobPurgeOldOrders = schedule.scheduleJob('0 * * * *', function () {
        purgeOldOrders();
    });
    if (processOrderCallback) {
        jobProcessOrders = schedule.scheduleJob(`${processOrderCronPattern}`, function () {
            processOrdersFromDB(processOrderCallback);
        });
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

function processOrdersFromDB(processOrderCallback) {
    const orders = orderDao.getOrdersNotDone(db);
    for (const order of orders) {
        processOrderCallback(order);
    };
}

function generateStatsFromDB(statsCallback) {    
    const stats = orderDao.getStats(db);
    statsCallback(stats);
}

function setOrderStage(orderId, stage) {
    orderDao.setOrderStage(db, orderId, stage);
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
        setOrderStage,
        updateOrderBody,
        getOrder
    }
    return module;
}

