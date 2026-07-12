export class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly analytics: AnalyticsClient,
  ) {}

  async accept(orderId: string): Promise<void> {
    await this.repository.transaction(async (tx) => {
      await tx.saveOrder(orderId);
      await tx.saveAudit(orderId, "accepted");
    });
    await this.analytics.track("order.accepted", { orderId });
  }
}

export interface OrderRepository {
  transaction(work: (tx: OrderRepository) => Promise<void>): Promise<void>;
  saveOrder(orderId: string): Promise<void>;
  saveAudit(orderId: string, action: string): Promise<void>;
}

export interface AnalyticsClient {
  track(event: string, payload: object): Promise<void>;
}
