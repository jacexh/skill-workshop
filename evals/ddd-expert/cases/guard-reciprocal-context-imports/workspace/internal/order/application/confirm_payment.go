package application

import paymentdomain "example/internal/payment/domain"

type PaymentHandler interface {
	ConfirmPayment(paymentID string) error
}

// ConfirmPayment also imports the upstream Domain package, closing a cycle
// between the two context implementation surfaces.
func ConfirmPayment(payment paymentdomain.Payment) error {
	return payment.ValidateCaptured()
}
