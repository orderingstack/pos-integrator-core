const ordersService = require('../src/orders-local-queue-service')(':memory:');
jest.setTimeout(10000);

const order1 = {
    id: 'a296192d-1850-4c2f-8aea-76f859fd682e',
    created: '2020-12-07',
    total: 123.12,
}

const order2 = {
    id: 'dbf0cc35-16cc-422b-9d14-d979d7e7dad6',
    created: '2020-12-04',
    total: 22.33,
}
const order3 = {
    id: 'dbf0cc35-16cc-422b-9d14-d979d7e7da33',
    created: '2020-12-01',
    total: 0.01,
}


test('add order to queue', async () => {
    ordersService.addOrderToProcessingQueue(order1, { processedLocally: 0, isCreatedCentrally: 1 });
    const order = await new Promise((resolve) => {
        ordersService.initOrdersQueue({
            processOrderLocallyCallback: (order) => {
                resolve(order);
            },
            processOrderCentrallyCallback: null,
            processLocallyCronPattern: `*/1 * * * * *`
        });
    });    
    ordersService.stopOrdersQueue();
    expect(order.processedLocally).toBe(0);
    expect(order.isCreatedCentrally).toBe(1);
    const orderBody = JSON.parse(order.orderbody);
    expect(orderBody.id).toBe(order1.id);
    ordersService.setOrderProcessedLocally(order.id, true);
});

test('add order to queue 2(processedLocally=1, centrally=1)', async () => {
    ordersService.addOrderToProcessingQueue(order2, { processedLocally: 1, processedCentrally: 0, isCreatedCentrally: 0 });
    const order = await new Promise((resolve) => {
        ordersService.initOrdersQueue({
            processOrderLocallyCallback: null,
            processOrderCentrallyCallback: (order) => {
                resolve(order);
            },            
            processCentrallyCronPattern: `*/1 * * * * *`
        });
    });    
    ordersService.stopOrdersQueue();
    expect(order.processedLocally).toBe(1);
    expect(order.isCreatedCentrally).toBe(0);
    const orderBody = JSON.parse(order.orderbody);
    expect(orderBody.id).toBe(order2.id);
    ordersService.setOrderProcessedLocally(order.id, true);
});

test('add order to queue (no params->processed locally=0)', async () => {
    ordersService.addOrderToProcessingQueue(order3);
    const order = await new Promise((resolve) => {
        ordersService.initOrdersQueue({
            processOrderLocallyCallback: (order) => {
                resolve(order);
            },
            processOrderCentrallyCallback: null,
            processLocallyCronPattern: `*/1 * * * * *`
        });
    });    
    ordersService.stopOrdersQueue();
    expect(order.processedLocally).toBe(0);
    expect(order.isCreatedCentrally).toBe(1);
    const orderBody = JSON.parse(order.orderbody)
    expect(orderBody.id).toBe(order3.id);
    ordersService.setOrderProcessedLocally(order.id, true);
});

test('set processedCentrally to true', ()=>{
    const order4 = {
        id: 'dbf0cc35-16cc-422b-9d14-d979d7e7da44',
        created: '2020-12-30',
    }
    ordersService.addOrderToProcessingQueue(order4, { processedLocally: 1, processedCentrally: 0, isCreatedCentrally: 0 });
    ordersService.setOrderProcessedCentrally(order4.id, true);
    const order = ordersService.getOrder(order4.id);
    expect(order.processedCentrally).toBe(1);
});