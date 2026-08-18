package domain

import "errors"

type Currency string

const USD Currency = "USD"

type Money struct {
	Minor    int64
	Currency Currency
}

type SettlementRate struct {
	Numerator   int64
	Denominator int64
}

func (r SettlementRate) Convert(amount int64) (int64, error) {
	if r.Numerator <= 0 || r.Denominator <= 0 {
		return 0, errors.New("settlement rate must be positive")
	}
	return amount * r.Numerator / r.Denominator, nil
}

type SettlementRateProvider interface {
	Rate(from Currency, to Currency) (SettlementRate, error)
}

type SettlementResult struct {
	Accepted bool
	Reason   string
}

type Invoice struct {
	id         string
	balanceUSD int64
	settled    bool
}

func NewInvoice(id string, balanceUSD int64) *Invoice {
	return &Invoice{id: id, balanceUSD: balanceUSD}
}

func (i *Invoice) Settle(payment Money, rates SettlementRateProvider) (SettlementResult, error) {
	if i.settled {
		return SettlementResult{Reason: "invoice is already settled"}, nil
	}
	if payment.Minor <= 0 {
		return SettlementResult{Reason: "payment amount must be positive"}, nil
	}

	converted := payment.Minor
	if payment.Currency != USD {
		rate, err := rates.Rate(payment.Currency, USD)
		if err != nil {
			return SettlementResult{}, err
		}
		converted, err = rate.Convert(payment.Minor)
		if err != nil {
			return SettlementResult{}, err
		}
	}
	if converted < i.balanceUSD {
		return SettlementResult{Reason: "payment does not cover invoice balance"}, nil
	}

	i.balanceUSD = 0
	i.settled = true
	return SettlementResult{Accepted: true}, nil
}

func (i *Invoice) Settled() bool {
	return i.settled
}
