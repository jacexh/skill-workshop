package billing

type Invoice struct {
	id                   string
	settled              bool
	persistenceConfirmed bool
}

func NewInvoice(id string) *Invoice {
	return &Invoice{id: id}
}

func (i *Invoice) Settle(paymentAmount int64) bool {
	if paymentAmount <= 0 || i.settled {
		return false
	}
	i.settled = true
	return true
}

func (i *Invoice) Settled() bool {
	return i.settled
}

func (i *Invoice) MarkPersistenceConfirmed() {
	i.persistenceConfirmed = true
}

func (i *Invoice) PersistenceConfirmed() bool {
	return i.persistenceConfirmed
}
