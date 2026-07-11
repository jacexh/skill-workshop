package messagesubscriber

import (
	"context"
	"fmt"

	paymentv1 "example.com/commerce/gen/payment/integration/v1"
	"example.com/commerce/internal/business/order/application"
	"example.com/commerce/internal/pkg/messagebus"
)

type PaymentCapturedSubscriber struct {
	handler *application.RecordPaymentHandler
}

var _ messagebus.Handler = (*PaymentCapturedSubscriber)(nil)

func NewPaymentCapturedSubscriber(
	handler *application.RecordPaymentHandler,
) *PaymentCapturedSubscriber {
	return &PaymentCapturedSubscriber{handler: handler}
}

func (*PaymentCapturedSubscriber) Listening() []string {
	return []string{paymentv1.PaymentCapturedMessageName}
}

func (s *PaymentCapturedSubscriber) Handle(ctx context.Context, message messagebus.Message) error {
	payload, ok := message.Payload().(*paymentv1.PaymentCaptured)
	if !ok {
		return fmt.Errorf("unexpected Payment Captured payload: %T", message.Payload())
	}
	return s.handler.Handle(ctx, application.RecordPaymentCommand{
		OrderID:   payload.OrderID,
		PaymentID: payload.PaymentID,
	})
}
