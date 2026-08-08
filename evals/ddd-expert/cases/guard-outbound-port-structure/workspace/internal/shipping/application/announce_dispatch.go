package application

import (
	"context"
	"encoding/json"
)

type HTTPPoster interface {
	PostJSON(context.Context, string, map[string]string, []byte) error
}

type AnnounceDispatch struct {
	poster   HTTPPoster
	endpoint string
}

func NewAnnounceDispatch(poster HTTPPoster, endpoint string) *AnnounceDispatch {
	return &AnnounceDispatch{poster: poster, endpoint: endpoint}
}

func (h *AnnounceDispatch) Handle(ctx context.Context, shipmentID, recipientID string) error {
	payload, err := json.Marshal(map[string]string{
		"shipment_id":  shipmentID,
		"recipient_id": recipientID,
	})
	if err != nil {
		return err
	}
	return h.poster.PostJSON(ctx, h.endpoint, map[string]string{"Content-Type": "application/json"}, payload)
}
