package messagesubscriber

import (
	"context"
	"errors"
	"testing"

	paymentv1 "example.com/commerce/gen/payment/integration/v1"
	"example.com/commerce/internal/business/order/application"
	"example.com/commerce/internal/pkg/messagebus"
)

type recordingPaymentRecorder struct {
	calls   int
	command application.RecordPaymentCommand
	err     error
}

func (r *recordingPaymentRecorder) RecordPayment(
	_ context.Context,
	command application.RecordPaymentCommand,
) error {
	r.calls++
	r.command = command
	return r.err
}

func TestPaymentCapturedSubscriberDelegatesOnce(t *testing.T) {
	recorder := &recordingPaymentRecorder{}
	subscriber := NewPaymentCapturedSubscriber(application.NewRecordPaymentHandler(recorder))

	kinds := subscriber.Listening()
	if len(kinds) != 1 || kinds[0] != paymentv1.PaymentCapturedMessageName {
		t.Fatalf("Listening() = %v", kinds)
	}

	err := subscriber.Handle(context.Background(), messagebus.NewMessage(&paymentv1.PaymentCaptured{
		OrderID:   "order-1",
		PaymentID: "payment-1",
	}))
	if err != nil {
		t.Fatalf("Handle() error = %v", err)
	}
	if recorder.calls != 1 {
		t.Fatalf("RecordPayment calls = %d, want 1", recorder.calls)
	}
	if recorder.command.OrderID != "order-1" || recorder.command.PaymentID != "payment-1" {
		t.Fatalf("RecordPayment command = %+v", recorder.command)
	}
}

func TestPaymentCapturedSubscriberRejectsUnexpectedPayload(t *testing.T) {
	recorder := &recordingPaymentRecorder{}
	subscriber := NewPaymentCapturedSubscriber(application.NewRecordPaymentHandler(recorder))

	err := subscriber.Handle(context.Background(), messagebus.NewMessage(struct{}{}))
	if err == nil {
		t.Fatal("Handle() error = nil, want payload error")
	}
	if recorder.calls != 0 {
		t.Fatalf("RecordPayment calls = %d, want 0", recorder.calls)
	}
}

func TestPaymentCapturedSubscriberPropagatesRecorderFailure(t *testing.T) {
	recordErr := errors.New("record payment")
	recorder := &recordingPaymentRecorder{err: recordErr}
	subscriber := NewPaymentCapturedSubscriber(application.NewRecordPaymentHandler(recorder))

	err := subscriber.Handle(context.Background(), messagebus.NewMessage(&paymentv1.PaymentCaptured{}))
	if !errors.Is(err, recordErr) {
		t.Fatalf("Handle() error = %v, want %v", err, recordErr)
	}
	if recorder.calls != 1 {
		t.Fatalf("RecordPayment calls = %d, want 1", recorder.calls)
	}
}
