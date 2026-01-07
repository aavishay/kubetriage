package integrations

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

type SlackPayload struct {
	Text        string            `json:"text"`
	Attachments []SlackAttachment `json:"attachments"`
}

type SlackAttachment struct {
	Color  string       `json:"color"`
	Title  string       `json:"title"`
	Text   string       `json:"text"`
	Fields []SlackField `json:"fields,omitempty"`
	Footer string       `json:"footer,omitempty"`
	Ts     int64        `json:"ts,omitempty"`
}

type SlackField struct {
	Title string `json:"title"`
	Value string `json:"value"`
	Short bool   `json:"short"`
}

var (
	SeverityColor = map[string]string{
		"Low":      "#36a64f", // Green
		"Medium":   "#ffcc00", // Yellow
		"High":     "#ff9900", // Orange
		"Critical": "#ff0000", // Red
	}
)

func SendSlackAlert(title, message, severity string, fields []SlackField) {
	webhookURL := os.Getenv("SLACK_WEBHOOK_URL")
	if webhookURL == "" {
		// Log but don't error, integration might be disabled
		return
	}

	color := SeverityColor[severity]
	if color == "" {
		color = "#cccccc"
	}

	payload := SlackPayload{
		Attachments: []SlackAttachment{
			{
				Color:  color,
				Title:  title,
				Text:   message,
				Fields: fields,
				Footer: "KubeTriage AI",
				Ts:     time.Now().Unix(),
			},
		},
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshalling Slack payload: %v", err)
		return
	}

	resp, err := http.Post(webhookURL, "application/json", bytes.NewBuffer(jsonBytes))
	if err != nil {
		log.Printf("Error sending Slack notification: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Slack API returned non-200 status: %d", resp.StatusCode)
	}
}
