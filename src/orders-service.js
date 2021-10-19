const axios = require("axios");

/**
Pulls open orders for venue. Uses provided access token to authenticate to rest api.   
* @param {*} venue - we pull orders for this venue  
* @param {*} token - access token   
 */
async function pullOrders(venue, token) {
  console.log("Pulling orders...");
  let response = null;
  try {
    response = await axios({
      method: "get",
      url: `${process.env.BASE_URL}/ordering-api/api/orders/venue/${venue}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

async function updateCentrallyOrderExtraAttr(token, orderId, store) {
  let result;
  try {
    result = await axios({
      method: "POST",
      url: `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/extra`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: {
        store,
      },
    });
    return true;
  } catch (err) {
    console.log(err);
    return false;
  }
}

async function postNewOrder(token, order) {
  const response = await axios({
    method: "post",
    url: `${process.env.BASE_URL}/ordering-api/api/order/new`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    data: order,
  });
  return response.data;
}

async function setOrderLinesProcessed(token, orderId, orderLines) {
  const response = await axios({
    method: "post",
    url: `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/lines/processed`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    data: [...orderLines],
  });
  return response.data;
}

async function postOrderQueueNumber(token, order, queueNumber) {
  const uid = order.id;
  const data = {
    venue: order.buckets[0].venue,
    queuePos: queueNumber,
  };
  console.log('---- post order queue set: >' + queueNumber + '<');
  try {
    const response = await axios({
      method: 'post',
      url: `${process.env.BASE_URL}/ordering-api/api/order/${uid}/queuePos`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data,
    });
    console.log('--- post order queue set result :' + response.status);
    return response;
  } catch (ex) {
    console.log(ex);
    return { status: ex.response.status, data: ex.response.data };
  }
}


module.exports = {
  pullOrders, updateCentrallyOrderExtraAttr, postNewOrder, setOrderLinesProcessed, postOrderQueueNumber
}