const posIntegration = require('./pos-integrations/pos-example.js')
const axios = require('axios');
const orderDao = require('./db/orders-dao');
const schedule = require('node-schedule'); 

const DB_ORDERS_RETENTION_DAYS = 4;

async function pullAndProcessOrders(venue, token) {
  const orders = await pullOrders(venue, token);
  for (const order of orders) {
    orderDao.upsertOrder(order);
  };
}

async function processOrder(message) {
  const order = message;
  try {
    orderDao.upsertOrder(order);
  } catch (ex) {
    console.error(ex);
  }
}


/**
Pulls open orders for venue. Uses provided access token to authenticate to rest api.   
* @param {*} venue - we pull orders for this venue  
* @param {*} token - access token   
 */
async function pullOrders(venue, token) {
  console.log('Pulling orders...');
  let response = null;
  try {
    response = await axios({
      method: 'get',
      url: `${process.env.BASE_URL}/ordering-api/api/orders/venue/${venue}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    const orders = [];
    for (const o of response.data) {
      if (o.completed) {
        orders.push(o);
      }
    }
    return orders;
  } catch (error) {
    console.error(error);
    return [];
  }
}

function initOrderService() {
  orderDao.createDatabase();

  /* run every hour */
  schedule.scheduleJob('0 * * * *', function () {
    purgeOrderMapFromOldOrders();
  });
  /* run every 30 seconds */
  schedule.scheduleJob('*/30 * * * * *', function () {
    processOrdersFromDB();
  });
}

function purgeOrderMapFromOldOrders() {
  orderDao.removeOlderThan(DB_ORDERS_RETENTION_DAYS);
}

function processOrdersFromDB() {
  const orders = orderDao.getNotProcessedOrders();
  for (const order of orders) {
    //do something with this order
    posIntegration.insertNewOrderToPOS(order);
    orderDao.setOrderAsProcessed(order.id);    
  };
}



module.exports = {
  pullAndProcessOrders, processOrder, initOrderService
}

//-------------------------
