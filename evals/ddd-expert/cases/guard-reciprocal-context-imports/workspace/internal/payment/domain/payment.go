package domain

type Payment struct {
	Captured bool
}

func (p Payment) ValidateCaptured() error {
	return nil
}
