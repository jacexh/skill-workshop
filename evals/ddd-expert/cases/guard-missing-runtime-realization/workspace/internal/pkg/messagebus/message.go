package messagebus

import "context"

type Message struct {
	payload any
}

func NewMessage(payload any) Message {
	return Message{payload: payload}
}

func (m Message) Payload() any {
	return m.payload
}

type Handler interface {
	Listening() []string
	Handle(context.Context, Message) error
}

type Subscriber interface {
	Subscribe(Handler) error
}
