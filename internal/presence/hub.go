package presence

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all for MVP
	},
}

// PresenceEvent represents a user action
type PresenceEvent struct {
	Type      string          `json:"type"` // "join", "leave", "view"
	UserID    string          `json:"userId"`
	UserName  string          `json:"userName"`
	AvatarURL string          `json:"avatarUrl"`
	TargetID  string          `json:"targetId"` // ReportID, WorkloadID, or Page path
	Timestamp int64           `json:"timestamp"`
	Payload   json.RawMessage `json:"payload,omitempty"` // Flexible payload for log state, comments, etc.
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan PresenceEvent
	register   chan *Client
	unregister chan *Client
	// In-memory state of who is viewing what
	viewers map[string]map[string]PresenceEvent // targetID -> userID -> Event
	mu      sync.RWMutex
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan PresenceEvent),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		viewers:    make(map[string]map[string]PresenceEvent),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case event := <-h.broadcast:
			h.updateState(event)
			h.broadcastToAll(event)
		}
	}
}

func (h *Hub) updateState(event PresenceEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if event.Type == "view" {
		if _, ok := h.viewers[event.TargetID]; !ok {
			h.viewers[event.TargetID] = make(map[string]PresenceEvent)
		}
		// Remove user from previous views if exclusive?
		// For now, allow multi-view or simple overwrite
		h.viewers[event.TargetID][event.UserID] = event
	} else if event.Type == "leave" {
		if views, ok := h.viewers[event.TargetID]; ok {
			delete(views, event.UserID)
			if len(views) == 0 {
				delete(h.viewers, event.TargetID)
			}
		}
	}
}

func (h *Hub) broadcastToAll(event PresenceEvent) {
	msg, _ := json.Marshal(event)
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		select {
		case client.send <- msg:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
}

// HandleWS upgrades HTTP to WebSocket
func (h *Hub) HandleWS(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Presence WS Error: %v", err)
		return
	}

	client := &Client{hub: h, conn: conn, send: make(chan []byte, 256)}
	h.register <- client

	// Start pump routines
	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	for {
		var event PresenceEvent
		err := c.conn.ReadJSON(&event)
		if err != nil {
			break
		}
		event.Timestamp = time.Now().UnixMilli()
		c.hub.broadcast <- event
	}
}

func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			c.conn.WriteMessage(websocket.TextMessage, message)
		}
	}
}
