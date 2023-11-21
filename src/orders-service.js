const axios = require("axios");
const { logger } = require('./logger');

/**
Pulls open orders for venue. Uses provided access token to authenticate to rest api.
* @param {*} venue - we pull orders for this venue
* @param {*} token - access token
 */
async function pullOrders(venue, token) {
  logger.debug("Pulling orders...");
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
    logger.error(error);
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
    logger.error(err);
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

async function postOrderPayment(token, order, paymentType) {
  if (parseFloat(order.editTotal) === 0) {
    //logger.debug(' <<<<<<<<   TOTAL:  ZERO     <<<<<<');
    return { status: 500, data: { error: "total === 0" } };
  }
  const data = {
    orderId: order.id,
    paymentType: paymentType,
    amount: order.editTotal,
    returnUrl: "",
    returnErrorUrl: "",
    TENANT: order.tenant,
  };
  try {
    const response = await axios({
      method: "post",
      url: `${process.env.BASE_URL}/payment-api/create`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data,
    });
    return response;
  } catch (ex) {
    return { status: ex.response.status, data: ex.response.data };
  }
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
  try {
    const response = await axios({
      method: "post",
      url: `${process.env.BASE_URL}/ordering-api/api/order/${uid}/queuePos`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data,
    });
    return response;
  } catch (error) {
    logger.error("postOrderQueueNumber - error", { error, orderId: uid });
    return { status: error.response.status, data: error.response.data };
  }
}


async function cancelOrder(token, orderId, cancelReason = undefined) {
  const data = {
    statusInfo: cancelReason
  };
  const response = await axios({
    method: "post",
    url: `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/cancel`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    data
  });
  return response.data;
}


module.exports = {
  pullOrders,
  updateCentrallyOrderExtraAttr,
  postNewOrder,
  setOrderLinesProcessed,
  postOrderQueueNumber,
  postOrderPayment,
  cancelOrder
};
