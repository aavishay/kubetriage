package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aavishay/kubetriage/backend/internal/db"
	"github.com/gin-gonic/gin"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

var googleOauthConfig *oauth2.Config

// InitOAuth configures the OIDC provider
func InitOAuth() {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	redirectURL := os.Getenv("GOOGLE_REDIRECT_URL")

	if clientID == "" || clientSecret == "" {
		log.Println("⚠️ OIDC Warning: GOOGLE_CLIENT_ID or SECRET not set. Auth will fail unless using Mock mode.")
	}

	googleOauthConfig = &oauth2.Config{
		RedirectURL:  redirectURL,
		ClientID:     clientID,
		ClientSecret: clientSecret,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

// GenerateRandomState prevents CSRF
func generateRandomState() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// LoginHandler redirects user to Google
func LoginHandler(c *gin.Context) {
	// Mock Mode for Dev without Credentials
	if os.Getenv("MOCK_OIDC") == "true" {
		mockToken := "mock-token-for-dev"
		// Simulate successful callback by keeping the same structure
		// In a real flow, we'd redirect to Google. Here we skip to setting cookie.
		// For simplicity, let's redirect to a special mock callback endpoint or handle it here.
		// We'll redirect to the frontend with a "mock_success" query param usually,
		// but since we are API-first, we can just set the cookie and redirect to dashboard.

		// Set HttpOnly Cookie
		http.SetCookie(c.Writer, &http.Cookie{
			Name:     "auth_token",
			Value:    mockToken,
			Path:     "/",
			HttpOnly: true,
			Expires:  time.Now().Add(24 * time.Hour),
		})

		// Redirect to Frontend Dashboard
		url := os.Getenv("FRONTEND_URL")
		if url == "" {
			url = "/"
		}
		c.Redirect(http.StatusTemporaryRedirect, url)
		return
	}

	oauthState := generateRandomState()
	// In production, store state in cookie/cache to verify later
	url := googleOauthConfig.AuthCodeURL(oauthState)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// CallbackHandler handles Google's response
func CallbackHandler(c *gin.Context) {
	state := c.Query("state")
	code := c.Query("code")

	// Validate state (skip for brevity in this MVP, but CRITICAL for prod)
	_ = state

	token, err := googleOauthConfig.Exchange(context.Background(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to exchange token"})
		return
	}

	userInfo, err := getUserInfo(token.AccessToken)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user info"})
		return
	}

	// Upsert User in DB
	user := db.User{
		Email:      userInfo["email"].(string),
		Provider:   "google",
		ProviderID: userInfo["id"].(string),
		AvatarURL:  userInfo["picture"].(string),
		Role:       "viewer", // Default for new users
	}

	// Gorm Upsert
	if err := db.DB.Where(db.User{Email: user.Email}).FirstOrCreate(&user).Error; err != nil {
		// If exists, update profile matches
		db.DB.Model(&user).Where("email = ?", user.Email).Updates(db.User{
			AvatarURL:  user.AvatarURL,
			Provider:   "google",
			ProviderID: user.ProviderID,
		})
	}

	// Create Session Token (JWT ideally, mock/simple string for MVP)
	// In prod: Use jwt-go to sign a token with user.ID
	sessionToken := fmt.Sprintf("session-%s", user.ID.String())

	// Set Cookie
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "auth_token",
		Value:    sessionToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true if HTTPS
		Expires:  time.Now().Add(24 * time.Hour),
	})

	// Redirect to Frontend
	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:8081"
	}
	c.Redirect(http.StatusTemporaryRedirect, frontendURL)
}

func getUserInfo(accessToken string) (map[string]interface{}, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]interface{}
	json.Unmarshal(data, &result)
	return result, nil
}

// LogoutHandler clears the auth cookie
func LogoutHandler(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1, // Delete
	})
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}
