const orderDao = require('../src/db/orders-dao');
let db = null;
test('create db from migration', ()=>{
    db = orderDao.createDatabase(':memory:');
});

test('upsert order and check is it is added', ()=>{
    orderDao.upsertOrder(db, order1);
    expect(orderDao.isOrderInDb(db, order1.id)).toBe(true);
    orderDao.upsertOrder(db, order2);
    expect(orderDao.isOrderInDb(db, order2.id)).toBe(true);
});

test('retrieve order from db', ()=>{
    const order = orderDao.getOrder(db, order1.id);
    const orderFull = JSON.parse(order.orderbody);
    expect(order1.total).toBe(orderFull.total);
});

test('remove orders older than x days', ()=>{
    orderDao.removeOlderThan(db, 2);
});

test('getOrdersNotYetLocallyProcessed, check order and condition', ()=>{    
    const orders = orderDao.getOrdersNotYetLocallyProcessed(db);
    expect(orders.length).toBe(0);
    orderDao.setOrderProcessedLocally(db, order1.id, false);
    const orders2 = orderDao.getOrdersNotYetLocallyProcessed(db);
    expect(orders2.length).toBe(1);
    orderDao.setOrderProcessedLocally(db, order1.id, true);
    const orders3 = orderDao.getOrdersNotYetLocallyProcessed(db);
    expect(orders3.length).toBe(0);
});

test('setOrderProcessedLocally', ()=>{
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


test('upsert order with additional columns', ()=>{
    const orderA = {
        id: 'f53d99fc-63e0-4a51-a9cd-0d3706d18900',
        created: '2020-12-12',
        total: 1.34,
        source: 'CENTRAL',
        processedLocally: 1,
    }
        
    orderDao.upsertOrder(db, orderA);
    expect(orderDao.getOrder(db, orderA.id).processedLocally).toBe(1);
});


const order1 = {
    id: 'a296192d-1850-4c2f-8aea-76f859fd682e',
    created: '2020-12-07',
    total: 123.12,
    source: 'CENTRAL'
}

var oldDate = new Date();
oldDate.setDate(oldDate.getDate()-5);
const order2 = {
    id: 'f53d99fc-63e0-4a51-a9cd-0d3706d189dc',
    created: oldDate.toISOString(),
    total: 99.99,
    source: 'CENTRAL'
}

