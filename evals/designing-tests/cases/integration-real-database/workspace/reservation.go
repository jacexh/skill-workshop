package reservation

type Repository interface {
	InsertReservation(resourceID, requestID string) (string, error)
	InsertOutbox(reservationID, requestID string) error
}

type Service struct {
	repository Repository
}

func (s Service) Reserve(resourceID, requestID string) error {
	reservationID, err := s.repository.InsertReservation(resourceID, requestID)
	if err != nil {
		return err
	}
	return s.repository.InsertOutbox(reservationID, requestID)
}
