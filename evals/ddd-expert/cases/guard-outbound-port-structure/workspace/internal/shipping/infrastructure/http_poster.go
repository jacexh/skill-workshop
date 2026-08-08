package infrastructure

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"example.com/shipping-review/internal/shipping/application"
)

type HTTPPoster struct {
	client *http.Client
}

func NewHTTPPoster(client *http.Client) *HTTPPoster {
	return &HTTPPoster{client: client}
}

func (p *HTTPPoster) PostJSON(ctx context.Context, endpoint string, headers map[string]string, payload []byte) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	for name, value := range headers {
		request.Header.Set(name, value)
	}
	response, err := p.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("notification provider returned %s", response.Status)
	}
	return nil
}

var _ application.HTTPPoster = (*HTTPPoster)(nil)
