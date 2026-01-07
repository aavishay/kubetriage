package auth

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuditMiddleware logs state-changing operations
func AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only audit state-changing methods
		if c.Request.Method == "GET" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Read Body to save details (careful with large bodies)
		var bodyBytes []byte
		if c.Request.Body != nil {
			bodyBytes, _ = io.ReadAll(c.Request.Body)
			// Restore the io.ReadCloser to its original state
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		}

		// Process request
		c.Next()

		// Only log successful ops or specific errors we care about
		if c.Writer.Status() >= 400 {
			// Optional: log failures too? For now, let's focus on successful mutations
			// return
		}

		// Get User from Context
		var userID *uuid.UUID
		var userEmail string
		if u, exists := c.Get(UserContextKey); exists {
			userInfo := u.(UserInfo)
			// Parse UUID
			if uid, err := uuid.Parse(userInfo.ID); err == nil {
				userID = &uid
			}
			userEmail = userInfo.Email
		}

		// Determine Action/Resource
		action := fmt.Sprintf("%s_REQUEST", c.Request.Method)
		resource := c.FullPath()

		// Create Audit Log
		audit := db.AuditLog{
			UserID:    userID,
			UserEmail: userEmail,
			Action:    action,
			Resource:  resource,
			Details:   string(bodyBytes), // Store JSON payload
			IPAddress: c.ClientIP(),
			CreatedAt: time.Now(),
		}

		// Save async to not block response? Or sync for strict audit?
		// We'll do sync for simplicity and reliability.
		if err := db.DB.Create(&audit).Error; err != nil {
			log.Printf("ERROR: Failed to write audit log: %v", err)
		}
	}
}
