const orderDao = require('../src/db/orders-dao');
let db = null;
test('create db from migration', () => {
  db = orderDao.createDatabase(':memory:');
});

test('upsert order and check is it is added', () => {
  orderDao.upsertOrder(db, order1);
  expect(orderDao.isOrderInDb(db, order1.id)).toBe(true);
  orderDao.upsertOrder(db, order2);
  expect(orderDao.isOrderInDb(db, order2.id)).toBe(true);
  orderDao.upsertOrder(db, orderAbandoned);
  expect(orderDao.isOrderInDb(db, orderAbandoned.id)).toBe(true);
  orderDao.upsertOrder(db, orderClosed);
  expect(orderDao.isOrderInDb(db, orderClosed.id)).toBe(true);
});

test('retrieves CLOSED and ABANDONED orders for processing if stage !== DONE', async () => {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const orders = orderDao.getOrdersToProcess(db);
  expect(orders.some((o) => o.orderStatus === 'ABANDONED')).toBe(true);
  expect(orders.some((o) => o.orderStatus === 'CLOSED')).toBe(true);
}, 4000);

test('check stats', () => {
  const stats = orderDao.getStats(db);
  expect(stats.totalOrders).toBe(4);
});

test('retrieve order from db', () => {
  const order = orderDao.getOrder(db, order1.id);
  expect(order1.orderbody).toBe(order.orderbody);
});

// test('remove orders older than x days', () => {
//     orderDao.removeOlderThan(db, 2);
// });

test('get order by stage, check order and condition', () => {
  const orders = orderDao.getOrdersInStage(db, 'SECOND');
  expect(orders.length).toBe(3);
  orderDao.setOrderStage(db, order1.id, 'SECOND');
  const orders2 = orderDao.getOrdersInStage(db, 'SECOND');
  expect(orders2.length).toBe(4);
  orderDao.setOrderStage(db, order1.id, 'DONE');
  const orders3 = orderDao.getOrdersInStage(db, 'SECOND');
  expect(orders3.length).toBe(3);
});

// test('setOrderProcessedLocally', () => {
//     const orderBefore = orderDao.getOrder(db, order2.id);
//     expect(orderBefore.processedLocally).toBeNull();
//     expect(orderBefore.processedLocallyAt).toBeNull();
//     orderDao.setOrderProcessedLocally(db, order2.id, false);
//     const orderAfter = orderDao.getOrder(db, order2.id);
//     expect(orderAfter.processedLocally).toBe(0);
//     expect(orderAfter.processedLocallyAt).toBeNull();
//     orderDao.setOrderProcessedLocally(db, order2.id, true);
//     const orderAfter2 = orderDao.getOrder(db, order2.id);
//     expect(orderAfter2.processedLocally).toBe(1);
//     expect(orderAfter2.processedLocallyAt).not.toBeNull();
// });

test('upsert order with additional columns', () => {
  const orderA = {
    id: 'f53d99fc-63e0-4a51-a9cd-0d3706d18900',
    created: '2020-12-12',
    orderStatus: 'NEW',
    orderbody: JSON.stringify({
      id: 'f53d99fc-63e0-4a51-a9cd-0d3706d18900',
      total: 1.34,
    }),
    isCreatedCentrally: 1,
    stage: 'FIRST',
  };

  orderDao.upsertOrder(db, orderA);
  expect(orderDao.getOrder(db, orderA.id).stage).toBe('FIRST');
});

test('is created centrally field', () => {
  const orderL = {
    id: 'f53d99fc-63e0-4a51-a9cd-0d3706d18901',
    created: '2020-12-13',
    orderStatus: 'NEW',
    orderbody: JSON.stringify({
      id: 'f53d99fc-63e0-4a51-a9cd-0d3706d18901',
      total: 4.56,
    }),
    isCreatedCentrally: 0,
    stage: 'STAGEX',
  };
  orderDao.upsertOrder(db, orderL);
  expect(orderDao.getOrder(db, orderL.id).isCreatedCentrally).toBe(0);
});

test('update order body', () => {
  const ob = JSON.parse(order1.orderbody);
  order1.orderbody = JSON.stringify({
    ...ob,
    newField: '123',
  });
  orderDao.updateOrderBody(db, order1);
  const retrievedOrder = orderDao.getOrder(db, order1.id);
  expect(retrievedOrder.orderbody).toBe(order1.orderbody);
});

test('remove closed orders', () => {
  const initialTotalOrders = orderDao.getStats(db).totalOrders;
  const orderA = {
    id: 'bfe47a95-95fd-419b-994d-4e61ca42c356',
    created: '2020-12-12',
    orderbody: JSON.stringify({
      id: 'bfe47a95-95fd-419b-994d-4e61ca42c356',
      total: 1.34,
    }),
    orderStatus: 'CLOSED',
    stage: 'DONE',
  };

  orderDao.upsertOrder(db, orderA);
  expect(orderDao.getStats(db).totalOrders).toBe(initialTotalOrders + 1);
  orderDao.removeClosedOrdersOrAbandoned(db);
  expect(orderDao.getStats(db).totalOrders).toBe(initialTotalOrders - 2);
});

test('should save extraData', () => {
  orderDao.upsertOrder(db, order1);
  orderDao.updateOrderExtraData(
    db,
    order1.id,
    JSON.stringify({ key: 'value' }),
  );
  const order = orderDao.getOrder(db, order1.id);
  expect(order.extraData).toBe('{"key":"value"}');
});

test('should save correct types', () => {
  const noOrder = orderDao.getOrder(db, 'non-existent-id');
  const order = orderDao.getOrder(db, order1.id);
  expect(typeof noOrder).toBe('undefined');
  expect(typeof order).toBe('object');
  expect(typeof order.isCreatedCentrally).toBe('number');
});

const order1 = {
  id: 'a296192d-1850-4c2f-8aea-76f859fd682e',
  created: '2020-12-07',
  orderStatus: 'NEW',
  orderbody: JSON.stringify({
    id: 'a296192d-1850-4c2f-8aea-76f859fd682e',
    total: 123.12,
  }),
  isCreatedCentrally: 1,
  stage: 'FIRST',
};

var oldDate = new Date();
oldDate.setDate(oldDate.getDate() - 5);
const order2 = {
  id: 'f53d99fc-63e0-4a51-a9cd-0d3706d189dc',
  created: oldDate.toISOString(),
  orderStatus: 'NEW',
  orderbody: JSON.stringify({
    id: 'f53d99fc-63e0-4a51-a9cd-0d3706d189dc',
    total: 99.99,
  }),
  isCreatedCentrally: 1,
  stage: 'SECOND',
};

const orderAbandoned = {
  id: '411fe885-4980-4ecf-bbb2-5a3f28506c65',
  created: new Date().toISOString(),
  orderStatus: 'ABANDONED',
  orderbody: JSON.stringify({
    id: '411fe885-4980-4ecf-bbb2-5a3f28506c65',
    total: 123.12,
  }),
  isCreatedCentrally: 1,
  stage: 'SECOND',
};

const orderClosed = {
  id: '4f2cda27-427c-48b3-a2ad-19a30d57b329',
  created: new Date().toISOString(),
  orderStatus: 'CLOSED',
  orderbody: JSON.stringify({
    id: '4f2cda27-427c-48b3-a2ad-19a30d57b329',
    total: 123.12,
  }),
  isCreatedCentrally: 1,
  stage: 'SECOND',
};
