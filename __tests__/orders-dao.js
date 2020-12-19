const orderDao = require('../src/db/orders-dao');
const fs = require('fs');
const { getOrder } = require('../src/db/orders-dao');

test('create db from migration', ()=>{
    orderDao.createDatabase(':memory:');
});

test('upsert order and check is it is added', ()=>{
    orderDao.upsertOrder(order1);
    expect(orderDao.isOrderInDb(order1.id)).toBe(true);
    orderDao.upsertOrder(order2);
    expect(orderDao.isOrderInDb(order2.id)).toBe(true);
});

test('retrieve order from db', ()=>{
    const order = orderDao.getOrder(order1.id);
    const orderFull = JSON.parse(order.orderbody);
    expect(order1.total).toBe(orderFull.total);
});

test('remove orders older than x days', ()=>{
    orderDao.removeOlderThan(2);
});

test('getNotProcessedOrders, check order and condition', ()=>{    
    const orders = orderDao.getNotProcessedOrders();
    expect(orders.length).toBe(2);
});

test('setOrderAsProcessed', ()=>{
    const orderBefore = getOrder(order1.id);
    orderDao.setOrderAsProcessed(order1.id);
    const orderAfter = getOrder(order1.id);
    expect(orderBefore.processed).toBe(0);
    expect(orderBefore.processedAt).toBeNull();
    expect(orderAfter.processed).toBe(1);
    expect(orderAfter.processedAt).not.toBeNull();
});



const order1 = {
    id: 'a296192d-1850-4c2f-8aea-76f859fd682e',
    created: '2020-12-07',
    total: 123.12
}

var oldDate = new Date();
oldDate.setDate(oldDate.getDate()-5);
const order2 = {
    id: 'f53d99fc-63e0-4a51-a9cd-0d3706d189dc',
    created: oldDate.toISOString(),
    total: 99.99
}

