package integrations

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestSendSlackAlert(t *testing.T) {
	// 1. Create a Mock Server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify method
		if r.Method != "POST" {
			t.Errorf("Expected POST request, got %s", r.Method)
		}

		// Verify body
		var payload SlackPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Errorf("Failed to decode request body: %v", err)
		}

		if len(payload.Attachments) == 0 {
			t.Errorf("Expected attachments in payload")
			return
		}

		att := payload.Attachments[0]
		if att.Title != "Test Alert" {
			t.Errorf("Expected title 'Test Alert', got '%s'", att.Title)
		}
		if att.Color != "#ff0000" { // Critical color
			t.Errorf("Expected color '#ff0000', got '%s'", att.Color)
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))
	defer server.Close()

	// 2. Set Env Var to Mock Server URL
	os.Setenv("SLACK_WEBHOOK_URL", server.URL)
	defer os.Unsetenv("SLACK_WEBHOOK_URL")

	// 3. Call Function
	SendSlackAlert("Test Alert", "This is a test", "Critical", nil)
}
