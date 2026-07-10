package application

import (
	"context"

	paymentv1 "example.com/contracts/payment/v1"
	"github.com/go-jimu/components/ddd/message"
)

type PaymentCapturedHandler struct {
	recordPayment func(context.Context, string, string) error
}

func (h *PaymentCapturedHandler) Listening() []message.Kind {
	return []message.Kind{message.KindOf(&paymentv1.PaymentCaptured{})}
}

func (h *PaymentCapturedHandler) Handle(ctx context.Context, envelope message.Message) error {
	payload := envelope.Payload().(*paymentv1.PaymentCaptured)
	return h.recordPayment(ctx, payload.GetOrderId(), payload.GetPaymentId())
}
