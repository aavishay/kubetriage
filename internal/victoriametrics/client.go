package victoriametrics

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

// Client wraps the Prometheus-compatible API client for VictoriaMetrics
type Client struct {
	api    v1.API
	config *Config
}

// Config holds VictoriaMetrics-specific configuration
type Config struct {
	Address        string
	BasicAuthUser  string
	BasicAuthPass  string
	BearerToken    string
	TLSConfig      *tls.Config
	Timeout        time.Duration
	MaxQueryRange  time.Duration // VM has different query range limits than Prometheus
}

var GlobalClient *Client

// InitVictoriaMetricsClient initializes a new VictoriaMetrics client
func InitVictoriaMetricsClient(cfg *Config) error {
	if cfg.Address == "" {
		cfg.Address = os.Getenv("VICTORIAMETRICS_URL")
		if cfg.Address == "" {
			return fmt.Errorf("victoriametrics address not provided")
		}
	}

	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}

	if cfg.MaxQueryRange == 0 {
		cfg.MaxQueryRange = 30 * 24 * time.Hour // VM default is typically 30 days
	}

	client, err := api.NewClient(api.Config{
		Address: cfg.Address,
		Client:  createHTTPClient(cfg),
	})
	if err != nil {
		return fmt.Errorf("error creating victoriametrics client: %v", err)
	}

	v1api := v1.NewAPI(client)
	GlobalClient = &Client{
		api:    v1api,
		config: cfg,
	}
	return nil
}

// createHTTPClient creates an HTTP client with proper auth and TLS settings
func createHTTPClient(cfg *Config) *http.Client {
	transport := &http.Transport{
		TLSClientConfig: cfg.TLSConfig,
	}

	// If basic auth or bearer token is needed, we would wrap the transport
	// For now, VictoriaMetrics typically uses the same auth mechanisms as Prometheus
	return &http.Client{
		Transport: transport,
		Timeout:   cfg.Timeout,
	}
}

// MetricPoint represents a single data point
type MetricPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}

// QueryRange executes a PromQL query over a time range
// VictoriaMetrics supports the same query API as Prometheus
func (c *Client) QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]MetricPoint, error) {
	// Validate query range
	if end.Sub(start) > c.config.MaxQueryRange {
		return nil, fmt.Errorf("query range %v exceeds maximum %v", end.Sub(start), c.config.MaxQueryRange)
	}

	r := v1.Range{
		Start: start,
		End:   end,
		Step:  step,
	}

	result, warnings, err := c.api.QueryRange(ctx, query, r)
	if err != nil {
		return nil, fmt.Errorf("victoriametrics query error: %v", err)
	}
	if len(warnings) > 0 {
		fmt.Printf("VictoriaMetrics Warnings: %v\n", warnings)
	}

	matrix, ok := result.(model.Matrix)
	if !ok {
		return nil, fmt.Errorf("unexpected result format: %T", result)
	}

	points := make([]MetricPoint, 0)
	if len(matrix) > 0 {
		for _, p := range matrix[0].Values {
			points = append(points, MetricPoint{
				Timestamp: int64(p.Timestamp),
				Value:     float64(p.Value),
			})
		}
	}

	return points, nil
}

// QueryVector executes an instant PromQL query
func (c *Client) QueryVector(ctx context.Context, query string) (float64, error) {
	result, warnings, err := c.api.Query(ctx, query, time.Now())
	if err != nil {
		return 0, fmt.Errorf("victoriametrics query error: %v", err)
	}
	if len(warnings) > 0 {
		fmt.Printf("VictoriaMetrics Warnings: %v\n", warnings)
	}

	vector, ok := result.(model.Vector)
	if !ok {
		return 0, fmt.Errorf("unexpected result format: %T", result)
	}

	if len(vector) > 0 {
		return float64(vector[0].Value), nil
	}
	return 0, nil
}

// QueryVectorRaw returns the raw model.Value (Vector)
func (c *Client) QueryVectorRaw(ctx context.Context, query string) (model.Value, error) {
	result, warnings, err := c.api.Query(ctx, query, time.Now())
	if err != nil {
		return nil, fmt.Errorf("victoriametrics query error: %v", err)
	}
	if len(warnings) > 0 {
		fmt.Printf("VictoriaMetrics Warnings: %v\n", warnings)
	}
	return result, nil
}

// HealthCheck performs a simple health check against VictoriaMetrics
func (c *Client) HealthCheck(ctx context.Context) error {
	// VictoriaMetrics has a /health endpoint or we can use a simple query
	_, _, err := c.api.Query(ctx, "up", time.Now())
	return err
}

// GetConfig returns the client configuration
func (c *Client) GetConfig() *Config {
	return c.config
}

// FromExternalSource creates a VictoriaMetrics client from an ExternalMetricSource configuration
func FromExternalSource(endpoint, apiKey string) (*Client, error) {
	cfg := &Config{
		Address:       endpoint,
		BearerToken:   apiKey,
		Timeout:       30 * time.Second,
		MaxQueryRange: 30 * 24 * time.Hour,
	}

	client, err := api.NewClient(api.Config{
		Address: cfg.Address,
	})
	if err != nil {
		return nil, fmt.Errorf("error creating victoriametrics client: %v", err)
	}

	v1api := v1.NewAPI(client)
	return &Client{
		api:    v1api,
		config: cfg,
	}, nil
}
