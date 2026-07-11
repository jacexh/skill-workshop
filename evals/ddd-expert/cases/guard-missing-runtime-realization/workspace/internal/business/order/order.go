package order

import (
	"example.com/commerce/internal/business/order/transport/messagesubscriber"
	"example.com/commerce/internal/pkg/messagebus"
)

type Module struct {
	subscriber      messagebus.Subscriber
	paymentCaptured *messagesubscriber.PaymentCapturedSubscriber
}

func NewModule(
	subscriber messagebus.Subscriber,
	paymentCaptured *messagesubscriber.PaymentCapturedSubscriber,
) *Module {
	return &Module{
		subscriber:      subscriber,
		paymentCaptured: paymentCaptured,
	}
}
