package domain

import "errors"

var ErrInsufficientBalance = errors.New("insufficient balance")

type Account struct {
	ID      string
	Balance int64
}

// SettleAccount displaced Account's accepted behavior into a receiver-shaped
// package function even though Account is its natural owner.
func SettleAccount(account *Account, amount int64) error {
	if account == nil || amount <= 0 || amount > account.Balance {
		return ErrInsufficientBalance
	}
	account.Balance -= amount
	return nil
}
