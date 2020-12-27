const orderDao = require('./db/orders-dao');
const ordersService = require('./orders-service');
const schedule = require('node-schedule');

const DB_ORDERS_RETENTION_DAYS = 4;
let db = null;

async function addOrderToProcessingQueue(message) {
    const order = message;
    if (orderDao.isOrderInDb(db, order.id)) {
        return;
    }
    order.processedLocally = 0;
    try {
        orderDao.upsertOrder(db, order);
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

function initOrdersQueue({ processOrderLocallyCallback, processOrderCentrallyCallback }) {
    db = orderDao.createDatabase();

    /* run every hour */
    schedule.scheduleJob('0 * * * *', function () {
        purgeOldOrders();
    });
    /* run every 15 seconds */
    schedule.scheduleJob('*/15 * * * * *', function () {
        locallyProcessOrdersFromDB(processOrderLocallyCallback);
    });
    /* run every 30 seconds */
    schedule.scheduleJob('*/30 * * * * *', function () {
        centrallyProcessOrdersFromDB(processOrderCentrallyCallback);
    });
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

module.exports = {
    initOrdersQueue,
    addOrderToProcessingQueue,
    pullOrdersAndAddToProcessingQueue,
    setOrderProcessedLocally,
    setOrderProcessedCentrally,
}

//-------------------------
