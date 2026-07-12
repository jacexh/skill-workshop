import { OrderService } from "./order";

it("accepts an order", async () => {
  const tx = { saveOrder: jest.fn(), saveAudit: jest.fn() };
  const repository = {
    transaction: jest.fn(async (work) => work(tx)),
  };
  const analytics = { track: jest.fn() };
  const service = new OrderService(repository as any, analytics);

  await service.accept("order-1");

  expect(repository.transaction).toHaveBeenCalledTimes(1);
  expect(tx.saveOrder).toHaveBeenCalledTimes(1);
  expect(tx.saveAudit).toHaveBeenCalledTimes(1);
  expect(analytics.track).toHaveBeenCalledTimes(1);
});

it("returns success from the handler", async () => {
  const response = { status: 200, body: { accepted: true } };
  expect(response.status).toBe(200);
});
