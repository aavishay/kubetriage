package prometheus

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/prometheus/client_golang/api"
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"
)

type Client struct {
	api v1.API
}

var GlobalClient *Client

func InitPrometheusClient() error {
	address := os.Getenv("PROMETHEUS_URL")
	if address == "" {
		// Default to internal cluster DNS if running in-cluster, or localhost for dev
		address = "http://prometheus-server"
	}

	client, err := api.NewClient(api.Config{
		Address: address,
	})
	if err != nil {
		return fmt.Errorf("error creating prometheus client: %v", err)
	}

	v1api := v1.NewAPI(client)
	GlobalClient = &Client{api: v1api}
	return nil
}

// MetricPoint represents a single data point
type MetricPoint struct {
	Timestamp int64   `json:"timestamp"`
	Value     float64 `json:"value"`
}

// QueryRange executes a PromQL query over a time range
func (c *Client) QueryRange(ctx context.Context, query string, start, end time.Time, step time.Duration) ([]MetricPoint, error) {
	r := v1.Range{
		Start: start,
		End:   end,
		Step:  step,
	}

	result, warnings, err := c.api.QueryRange(ctx, query, r)
	if err != nil {
		return nil, fmt.Errorf("prometheus query error: %v", err)
	}
	if len(warnings) > 0 {
		fmt.Printf("Prometheus Warnings: %v\n", warnings)
	}

	matrix, ok := result.(model.Matrix)
	if !ok {
		return nil, fmt.Errorf("unexpected result format: %T", result)
	}

	// We expect a single timeseries for now (e.g. sum of pods)
	// If multiple series returned, we might just take the first one or sum them up in the query
	points := make([]MetricPoint, 0)

	if len(matrix) > 0 {
		// Taking the first stream
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
		return 0, fmt.Errorf("prometheus query error: %v", err)
	}
	if len(warnings) > 0 {
		fmt.Printf("Prometheus Warnings: %v\n", warnings)
	}

	vector, ok := result.(model.Vector)
	if !ok {
		return 0, fmt.Errorf("unexpected result format: %T", result)
	}

	if len(vector) > 0 {
		return float64(vector[0].Value), nil
	}
	return 0, nil // No data
}
