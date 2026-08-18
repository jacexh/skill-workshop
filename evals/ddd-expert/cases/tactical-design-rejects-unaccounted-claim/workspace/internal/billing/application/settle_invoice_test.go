package application

import (
	"errors"
	"testing"

	"example.com/billing/internal/billing/domain"
)

type rateProvider struct {
	rate  domain.SettlementRate
	err   error
	calls int
}

func (p *rateProvider) Rate(from domain.Currency, to domain.Currency) (domain.SettlementRate, error) {
	p.calls++
	if from != "EUR" || to != domain.USD {
		return domain.SettlementRate{}, errors.New("unexpected currency pair")
	}
	return p.rate, p.err
}

func TestSettleInvoiceLetsDomainOwnRateTiming(t *testing.T) {
	rates := &rateProvider{rate: domain.SettlementRate{Numerator: 2, Denominator: 1}}
	service := NewSettleInvoiceService(rates)
	invoice := domain.NewInvoice("invoice-1", 100)

	rejected, err := service.SettleInvoice(invoice, domain.Money{Minor: 0, Currency: "EUR"})
	if err != nil {
		t.Fatalf("reject invalid payment: %v", err)
	}
	if rejected.Accepted || rates.calls != 0 {
		t.Fatal("locally invalid payment must not request an authoritative rate")
	}

	accepted, err := service.SettleInvoice(invoice, domain.Money{Minor: 50, Currency: "EUR"})
	if err != nil {
		t.Fatalf("settle foreign-currency payment: %v", err)
	}
	if !accepted.Accepted || !invoice.Settled() {
		t.Fatal("authoritative converted payment should settle the invoice")
	}
	if rates.calls != 1 {
		t.Fatalf("rate calls = %d, want 1", rates.calls)
	}
}
