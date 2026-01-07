package auth

import (
	"net/http"
	"strings"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
)

// Constants for roles
const (
	RoleAdmin    = "admin"
	RoleReadOnly = "readonly"
)

// UserContextKey is the key used to store user info in context
const UserContextKey = "user"

// UserInfo struct
type UserInfo struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

// AuthMiddleware extracts user identity
// For now, it mocks an Admin user for dev purposes
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Check for Cookie (OIDC Flow)
		cookie, err := c.Cookie("auth_token")
		if err == nil && cookie != "" {
			// In a real implementation: Parse JWT
			// For MVP: Check if simple string format
			if strings.HasPrefix(cookie, "session-") {
				userIdStr := strings.TrimPrefix(cookie, "session-")

				var dbUser db.User
				if result := db.DB.First(&dbUser, "id = ?", userIdStr); result.Error == nil {
					user := UserInfo{
						ID:    dbUser.ID.String(),
						Email: dbUser.Email,
						Role:  dbUser.Role,
					}
					c.Set(UserContextKey, user)
					c.Next()
					return
				}
			}

			// Handle Mock Token
			if cookie == "mock-token-for-dev" {
				user := UserInfo{
					ID:    "dev-admin-id",
					Email: "admin@kubetriage.com",
					Role:  RoleAdmin,
				}
				c.Set(UserContextKey, user)
				c.Next()
				return
			}
		}

		// 2. Check for Header (Legacy/API Access)
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || strings.HasPrefix(authHeader, "Bearer mock-token") {
			// Development Mode fallback for API clients not using Browser Cookies
			if authHeader != "" {
				user := UserInfo{
					ID:    "dev-api-id",
					Email: "api@kubetriage.com",
					Role:  RoleAdmin,
				}
				c.Set(UserContextKey, user)
				c.Next()
				return
			}
		}

		// If we get here, unauthorized
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
	}
}

// RequireRole middleware enforces RBAC
func RequireRole(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, exists := c.Get(UserContextKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		userInfo, ok := user.(UserInfo)
		if !ok {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "Invalid user context"})
			return
		}

		// Simple RBAC: Admin can do everything
		if userInfo.Role == RoleAdmin {
			c.Next()
			return
		}

		if userInfo.Role != requiredRole {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}
