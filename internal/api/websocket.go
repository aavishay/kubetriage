package api

import (
	"bufio"
	"io"
	"log"
	"net/http"

	"github.com/aavishay/kubetriage/backend/internal/k8s"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"k8s.io/client-go/kubernetes"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

func StreamLogsHandler(c *gin.Context) {
	clusterID := c.Query("clusterId")
	namespace := c.Query("namespace")
	podName := c.Query("podName")
	container := c.Query("container")

	if namespace == "" || podName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "namespace and podName are required"})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade to websocket: %v", err)
		return
	}
	defer ws.Close()

	// VPN MODE: Connect to selected cluster on-demand
	var client *kubernetes.Clientset
	if clusterID != "" && k8s.Manager != nil {
		cls, err := k8s.Manager.GetOrConnectCluster(clusterID)
		if err != nil {
			ws.WriteMessage(websocket.TextMessage, []byte("Error: Cannot connect to cluster. Please ensure VPN is connected."))
			return
		}
		client = cls.ClientSet
	}
	if client == nil {
		client = k8s.ClientSet
	}

	var tailLines int64 = 100
	reader, err := k8s.GetPodLogStream(c.Request.Context(), client, namespace, podName, container, true, &tailLines)
	if err != nil {
		log.Printf("Error getting log stream: %v", err)
		ws.WriteMessage(websocket.TextMessage, []byte("Error connecting to log stream: "+err.Error()))
		return
	}
	defer reader.Close()

	// Stream logs to WebSocket
	// We'll use a scanner to read line by line
	scanner := bufio.NewScanner(reader)

	// Create a channel to handle stopping
	done := make(chan struct{})

	// Goroutine to handle incoming messages (e.g. close)
	go func() {
		defer close(done)
		for {
			_, _, err := ws.ReadMessage()
			if err != nil {
				return
			}
		}
	}()

	for scanner.Scan() {
		select {
		case <-done:
			return
		default:
			text := scanner.Text()
			if err := ws.WriteMessage(websocket.TextMessage, []byte(text)); err != nil {
				log.Printf("Error writing to websocket: %v", err)
				return
			}
		}
	}

	if err := scanner.Err(); err != nil {
		if err != io.EOF {
			ws.WriteMessage(websocket.TextMessage, []byte("Stream error: "+err.Error()))
		}
	}
}
