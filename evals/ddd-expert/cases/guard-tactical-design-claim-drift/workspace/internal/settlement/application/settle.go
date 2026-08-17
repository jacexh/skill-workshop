package application

import (
	"context"

	"example.com/settlement/internal/settlement/domain"
)

type AccountRepository interface {
	Get(context.Context, string) (*domain.Account, error)
	Save(context.Context, *domain.Account) error
}

type Transactor interface {
	Within(context.Context, func(context.Context) error) error
}

type SettlementPublisher interface {
	PublishCompleted(context.Context, string) error
}

type SettleHandler struct {
	accounts  AccountRepository
	transact  Transactor
	publisher SettlementPublisher
}

func NewSettleHandler(accounts AccountRepository, transact Transactor, publisher SettlementPublisher) *SettleHandler {
	return &SettleHandler{accounts: accounts, transact: transact, publisher: publisher}
}

func (h *SettleHandler) Handle(ctx context.Context, accountID string, amount int64) error {
	if err := h.publisher.PublishCompleted(ctx, accountID); err != nil {
		return err
	}

	return h.transact.Within(ctx, func(txCtx context.Context) error {
		account, err := h.accounts.Get(txCtx, accountID)
		if err != nil {
			return err
		}
		if err := account.Settle(amount); err != nil {
			return err
		}
		return h.accounts.Save(txCtx, account)
	})
}
