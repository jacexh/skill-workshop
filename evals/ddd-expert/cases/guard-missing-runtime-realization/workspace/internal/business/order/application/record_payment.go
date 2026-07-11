package application

import "context"

type RecordPaymentCommand struct {
	OrderID   string
	PaymentID string
}

type PaymentRecorder interface {
	RecordPayment(context.Context, RecordPaymentCommand) error
}

type RecordPaymentHandler struct {
	recorder PaymentRecorder
}

func NewRecordPaymentHandler(recorder PaymentRecorder) *RecordPaymentHandler {
	return &RecordPaymentHandler{recorder: recorder}
}

func (h *RecordPaymentHandler) Handle(ctx context.Context, command RecordPaymentCommand) error {
	return h.recorder.RecordPayment(ctx, command)
}
