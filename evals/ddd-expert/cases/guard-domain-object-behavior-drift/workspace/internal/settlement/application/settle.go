package application

import (
	"context"

	"example.com/settlement/internal/settlement/domain"
)

type AccountRepository interface {
	Get(context.Context, string) (*domain.Account, error)
	Save(context.Context, *domain.Account) error
}

type SettleHandler struct {
	accounts AccountRepository
}

func NewSettleHandler(accounts AccountRepository) *SettleHandler {
	return &SettleHandler{accounts: accounts}
}

func (h *SettleHandler) Handle(ctx context.Context, accountID string, amount int64) error {
	account, err := h.accounts.Get(ctx, accountID)
	if err != nil {
		return err
	}
	if err := domain.SettleAccount(account, amount); err != nil {
		return err
	}
	return h.accounts.Save(ctx, account)
}
