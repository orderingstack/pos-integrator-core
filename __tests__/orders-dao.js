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
});

test('check stats', () => {
    const stats = orderDao.getStats(db);
    expect(stats.totalOrders).toBe(2);
});


test('retrieve order from db', () => {
    const order = orderDao.getOrder(db, order1.id);
    expect(order1.orderbody).toBe(order.orderbody);
});

// test('remove orders older than x days', () => {
//     orderDao.removeOlderThan(db, 2);
// });

test('getOrdersNotYetLocallyProcessed, check order and condition', () => {
    const orders = orderDao.getOrdersNotYetLocallyProcessed(db);
    expect(orders.length).toBe(0);
    orderDao.setOrderProcessedLocally(db, order1.id, false);
    const orders2 = orderDao.getOrdersNotYetLocallyProcessed(db);
    expect(orders2.length).toBe(1);
    orderDao.setOrderProcessedLocally(db, order1.id, true);
    const orders3 = orderDao.getOrdersNotYetLocallyProcessed(db);
    expect(orders3.length).toBe(0);
});

test('setOrderProcessedLocally', () => {
    const orderBefore = orderDao.getOrder(db, order2.id);
    expect(orderBefore.processedLocally).toBeNull();
    expect(orderBefore.processedLocallyAt).toBeNull();
    orderDao.setOrderProcessedLocally(db, order2.id, false);
    const orderAfter = orderDao.getOrder(db, order2.id);
    expect(orderAfter.processedLocally).toBe(0);
    expect(orderAfter.processedLocallyAt).toBeNull();
    orderDao.setOrderProcessedLocally(db, order2.id, true);
    const orderAfter2 = orderDao.getOrder(db, order2.id);
    expect(orderAfter2.processedLocally).toBe(1);
    expect(orderAfter2.processedLocallyAt).not.toBeNull();
});


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
        processedLocally: 1,
    }

    orderDao.upsertOrder(db, orderA);
    expect(orderDao.getOrder(db, orderA.id).processedLocally).toBe(1);
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
        processedLocally: 1,
    }
    orderDao.upsertOrder(db, orderL);
    expect(orderDao.getOrder(db, orderL.id).isCreatedCentrally).toBe(0);
});

test('update order body', () => {
    const ob = JSON.parse(order1.orderbody);
    order1.orderbody = JSON.stringify({
        ...ob,
        newField: '123'
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
        isCreatedCentrally: 1,
        processedLocally: 1,
    }

    orderDao.upsertOrder(db, orderA);
    expect(orderDao.getStats(db).totalOrders).toBe(initialTotalOrders+1);
    orderDao.removeClosedOrdersOrAbandoned(db);
    expect(orderDao.getStats(db).totalOrders).toBe(initialTotalOrders);
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
}

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
}

