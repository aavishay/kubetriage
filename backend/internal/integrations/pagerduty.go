package integrations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

type PagerDutyPayload struct {
	RoutingKey  string         `json:"routing_key"`
	EventAction string         `json:"event_action"`
	DedupKey    string         `json:"dedup_key,omitempty"`
	Payload     PDEventPayload `json:"payload"`
}

type PDEventPayload struct {
	Summary   string `json:"summary"`
	Source    string `json:"source"`
	Severity  string `json:"severity"`
	Timestamp string `json:"timestamp"`
}

func TriggerPagerDutyIncident(summary, source, severity string) error {
	routingKey := os.Getenv("PAGERDUTY_ROUTING_KEY")
	if routingKey == "" {
		// Log but don't error, integration might be disabled
		return nil
	}

	payload := PagerDutyPayload{
		RoutingKey:  routingKey,
		EventAction: "trigger",
		Payload: PDEventPayload{
			Summary:   summary,
			Source:    source,
			Severity:  severity,
			Timestamp: time.Now().Format(time.RFC3339),
		},
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal PagerDuty payload: %w", err)
	}

	resp, err := http.Post("https://events.pagerduty.com/v2/enqueue", "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		return fmt.Errorf("failed to send PagerDuty event: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("PagerDuty API returned status: %d", resp.StatusCode)
	}

	log.Printf("PagerDuty incident triggered: %s", summary)
	return nil
}
