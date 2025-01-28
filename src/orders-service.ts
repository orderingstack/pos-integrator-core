import { IOrder } from '@orderingstack/ordering-types';
import axios from 'axios';
import { logger } from './logger';

interface ICorrelationResponse {
  correlationId: string;
  orderId: string;
}

/**
Pulls open orders for venue. Uses provided access token to authenticate to rest api.   
* @param {*} venue - we pull orders for this venue  
* @param {*} token - access token   
 */
async function pullOrders(venue: string, token: string) {
  logger.debug('Pulling orders...');
  let response = null;
  try {
    response = await axios.get<IOrder[]>(
      `${process.env.BASE_URL}/ordering-api/api/orders/venue/${venue}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
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

async function updateCentrallyOrderExtraAttr(
  token: string,
  orderId: string,
  store: Record<string, string> | IOrder['extra'],
) {
  try {
    await axios.post<ICorrelationResponse>(
      `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/extra`,
      {
        store,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return true;
  } catch (err) {
    logger.error(err);
    return false;
  }
}

async function postNewOrder(token: string, order: IOrder) {
  const response = await axios.post<
    ICorrelationResponse & { lines?: string[] }
  >(`${process.env.BASE_URL}/ordering-api/api/order/new`, order, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
}

async function postOrderPayment(
  token: string,
  order: IOrder,
  paymentType: number,
) {
  const data = {
    orderId: order.id,
    paymentType: paymentType,
    amount: order.editTotal,
    returnUrl: '',
    returnErrorUrl: '',
    TENANT: order.tenant,
  };
  try {
    return await axios.post(
      `${process.env.BASE_URL}/payment-api/create`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
  } catch (ex: any) {
    return { status: ex.response?.status, data: ex.response?.data };
  }
}

async function setOrderLinesProcessed(
  token: string,
  orderId: string,
  orderLinesIds: string[],
) {
  const response = await axios.post<ICorrelationResponse>(
    `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/lines/processed`,
    orderLinesIds,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

async function postOrderQueueNumber(
  token: string,
  order: IOrder,
  queueNumber: string,
) {
  const uid = order.id;
  const data = {
    venue: order.buckets?.[0]?.venue,
    queuePos: queueNumber,
  };
  try {
    const response = await axios.post<ICorrelationResponse>(
      `${process.env.BASE_URL}/ordering-api/api/order/${uid}/queuePos`,
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    logger.debug('--- post order queue set result :' + response.status, {
      orderId: uid,
    });
    return response;
  } catch (error: any) {
    logger.error('postOrderQueueNumber - error', { error, orderId: uid });
    return { status: error.response?.status, data: error.response?.data };
  }
}

async function cancelOrder(
  token: string,
  orderId: string,
  statusInfo?: string,
) {
  const data = {
    statusInfo,
  };
  const response = await axios.post<ICorrelationResponse>(
    `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/cancel`,
    data,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  );
  return response.data;
}

async function getOrder(
  token: string,
  orderId: string,
): Promise<{ notFound?: boolean; order?: IOrder; error?: any }> {
  try {
    const response = await axios.get<IOrder>(
      `${process.env.BASE_URL}/ordering-api/api/orders/${orderId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { order: response.data };
  } catch (e: any) {
    if (e.response?.status === 404) {
      return { notFound: true };
    }
    return { error: e };
  }
}

async function appendLinesToOrder(
  token: string,
  orderId: string,
  venue: string,
  lines: Array<{
    productId: string;
    status: 'NEW' | 'CONFIRMED';
    quantity: number;
    price?: number;
    productConfig?: any;
    comment?: string;
    extra?: any;
  }>,
) {
  try {
    const response = await axios.post<{
      correlationId: string;
      orderId: string;
      lines: string[];
    }>(
      `${process.env.BASE_URL}/ordering-api/api/order/${orderId}/append`,
      { venue, lines },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      },
    );
    return { data: response.data };
  } catch (e: any) {
    console.error(e);
    return { error: e };
  }
}

export const orderService = {
  pullOrders,
  updateCentrallyOrderExtraAttr,
  postNewOrder,
  getOrder,
  setOrderLinesProcessed,
  postOrderQueueNumber,
  postOrderPayment,
  cancelOrder,
  appendLinesToOrder,
};
