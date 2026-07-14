package application

import orderapp "example/internal/order/application"

// NotifyOrder directly calls the downstream Application package.
func NotifyOrder(handler orderapp.PaymentHandler, paymentID string) error {
	return handler.ConfirmPayment(paymentID)
}
