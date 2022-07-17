const listener = require('./ws-listener');
const authorization = require('./authorization');
const orderService = require('./orders-service');
const ordersQueue = require('./orders-local-queue-service');
const productService = require('./products-service');
const {setLogger} = require('./logger');

module.exports = {
    authorization,
    listener, 
    orderService,
    ordersQueue,
    productService,
    setLogger
}
