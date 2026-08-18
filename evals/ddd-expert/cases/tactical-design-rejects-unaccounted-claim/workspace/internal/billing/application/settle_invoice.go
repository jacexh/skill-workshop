package application

import "example.com/billing/internal/billing/domain"

type SettleInvoiceService struct {
	rates domain.SettlementRateProvider
}

func NewSettleInvoiceService(rates domain.SettlementRateProvider) *SettleInvoiceService {
	return &SettleInvoiceService{rates: rates}
}

func (s *SettleInvoiceService) SettleInvoice(
	invoice *domain.Invoice,
	payment domain.Money,
) (domain.SettlementResult, error) {
	return invoice.Settle(payment, s.rates)
}
