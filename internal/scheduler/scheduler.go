package scheduler

import (
	"log"

	"github.com/aavishay/kubetriage/backend/internal/ai"
	"github.com/robfig/cron/v3"
)

var c *cron.Cron

func InitScheduler(aiService *ai.AIService) {
	c = cron.New()

	// Register Jobs
	_, err := c.AddFunc("@every 2m", func() { RunWorkloadScanner(aiService) })
	if err != nil {
		log.Printf("Error adding cron job: %v", err)
	}

	c.Start()
	log.Println("Scheduler initialized and started")
}

func StopScheduler() {
	if c != nil {
		c.Stop()
	}
}
