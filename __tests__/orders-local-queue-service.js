const ordersService = require("../src/orders-local-queue-service")(":memory:");
jest.setTimeout(10000);

const order1 = {
  id: "a296192d-1850-4c2f-8aea-76f859fd682e",
  created: "2020-12-07",
  total: 123.12,
};

const order2 = {
  id: "dbf0cc35-16cc-422b-9d14-d979d7e7dad6",
  created: "2020-12-04",
  total: 22.33,
};
const order3 = {
  id: "dbf0cc35-16cc-422b-9d14-d979d7e7da33",
  created: "2020-12-01",
  total: 0.01,
};

test("add order to queue", async () => {
  ordersService.addOrderToProcessingQueue(order1, {
    stage: "FIRST",
    isCreatedCentrally: 1,
  });
  const order = await new Promise((resolve) => {
    ordersService.initOrdersQueue({
      processOrderCallback: (order) => {
        if (order.stage === "FIRST") {
          resolve(order);
        }
      },
      processOrderCronPattern: `*/1 * * * * *`,
    });
  });
  ordersService.stopOrdersQueue();
  expect(order.stage).toBe("FIRST");
  expect(order.isCreatedCentrally).toBe(1);
  const orderBody = JSON.parse(order.orderbody);
  expect(orderBody.id).toBe(order1.id);
  ordersService.setOrderStage(order.id, "DONE");
});

test("add order to queue 2(stage=FIRST) and transit it to stage=SECOND", async () => {
  ordersService.addOrderToProcessingQueue(order2, {
    stage: "FIRST",
    isCreatedCentrally: 0,
  });
  await new Promise((resolve) => {
    ordersService.initOrdersQueue({
      processOrderCallback: (order) => {
        if (order.stage === "FIRST") {
          ordersService.setOrderStage(order2.id, "SECOND");
          resolve();
        }
      },
      processOrderCronPattern: `*/1 * * * * *`,
    });
  });
  ordersService.stopOrdersQueue();
  const orderNew = ordersService.getOrder(order2.id);
  expect(orderNew.stage).toBe("SECOND");
  expect(orderNew.isCreatedCentrally).toBe(0);
  const orderBody = JSON.parse(orderNew.orderbody);
  expect(orderBody.id).toBe(order2.id);
});

test("add order to queue (no params->processed locally=0)", async () => {
  ordersService.addOrderToProcessingQueue(order3);
  const order = await new Promise((resolve) => {
    ordersService.initOrdersQueue({
      processOrderCallback: (order) => {
        if (order.stage === "NEW") {
          resolve(order);
        }
      },
      processOrderCronPattern: `*/1 * * * * *`,
    });
  });
  ordersService.stopOrdersQueue();
  expect(order.stage).toBe("NEW");
  expect(order.isCreatedCentrally).toBe(1);
  const orderBody = JSON.parse(order.orderbody);
  expect(orderBody.id).toBe(order3.id);
});

test("set processedCentrally to true", () => {
  const order4 = {
    id: "dbf0cc35-16cc-422b-9d14-d979d7e7da44",
    created: "2020-12-30",
  };
  ordersService.addOrderToProcessingQueue(order4, {
    stage: "AAA",
    isCreatedCentrally: 0,
  });
  ordersService.setOrderStage(order4.id, "BBB");
  const order = ordersService.getOrder(order4.id);
  expect(order.stage).toBe("BBB");
});
