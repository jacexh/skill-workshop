package domain

import "errors"

var ErrInsufficientBalance = errors.New("insufficient balance")

type Account struct {
	ID      string
	Balance int64
}

func (a *Account) Settle(amount int64) error {
	if amount <= 0 || amount > a.Balance {
		return ErrInsufficientBalance
	}
	a.Balance -= amount
	return nil
}
