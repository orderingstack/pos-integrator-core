const taskDao = require('../src/db/task-dao');
let db = null;
test('create db from migration', () => {
    db = taskDao.createDatabase(':memory:');
});

test('insert task and check is it is added', () => {
    const taskId1 = taskDao.insertTask(db, task1);
    expect(taskId1).toBe(1);
    const taskId2 = taskDao.insertTask(db, task2);
    expect(taskId2).toBe(2);
});
/*
test('retrieve order from db', () => {
    const order = taskDao.getOrder(order1.id);
    const orderFull = JSON.parse(order.orderbody);
    expect(order1.total).toBe(orderFull.total);
});

test('remove orders older than x days', () => {
    taskDao.removeOlderThan(2);
});

test('getNotProcessedOrders, check order and condition', () => {
    const orders = taskDao.getNotProcessedOrders();
    expect(orders.length).toBe(2);
});

test('setOrderAsProcessed', () => {
    const orderBefore = getOrder(order1.id);
    taskDao.setOrderAsProcessed(order1.id);
    const orderAfter = getOrder(order1.id);
    expect(orderBefore.processed).toBe(0);
    expect(orderBefore.processedAt).toBeNull();
    expect(orderAfter.processed).toBe(1);
    expect(orderAfter.processedAt).not.toBeNull();
});
*/


const task1 = {
    name: 'set-synchronized',
    payload: '{orderId:"123"}',
}

const task2 = {
    name: 'set-synchronized',
    payload: '{orderId:"456"}',
}


