package domain

import (
	"errors"
	"strings"
)

var ErrOrderNameRequired = errors.New("order name is required")

type Order struct {
	id   string
	name string
}

func NewOrder(id, name string) (*Order, error) {
	if strings.TrimSpace(name) == "" {
		return nil, ErrOrderNameRequired
	}
	return &Order{id: id, name: name}, nil
}

func (o *Order) ID() string {
	return o.id
}

func (o *Order) Name() string {
	return o.name
}
