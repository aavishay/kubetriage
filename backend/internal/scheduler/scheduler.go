package scheduler

import (
	"log"

	"github.com/robfig/cron/v3"
)

var c *cron.Cron

func InitScheduler() {
	c = cron.New()

	// Register Jobs
	_, err := c.AddFunc("@every 2m", RunWorkloadScanner) // Run every 2 mins for demo purposes
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
