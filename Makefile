.PHONY: all build run test clean docker-up docker-down

# Default target
all: build

# Build the final binary
build: 
	@echo "🏗️  Building Frontend..."
	cd frontend && npm install --legacy-peer-deps && npm run build
	@echo "🏗️  Building Go binary..."
	go build -o kubetriage cmd/server/main.go
	@echo "✅ Build complete! Run ./kubetriage to start."

# Run Local (Dev)
run:
	@echo "🚀 Starting KubeTriage..."
	go run ./cmd/server

# Docker Compose Operations
docker-up:
	@echo "🐳 Starting Docker Compose..."
	docker compose up -d --build

docker-down:
	@echo "🛑 Stopping Docker Compose..."
	docker compose down

docker-logs:
	@echo "📜 Streaming Logs..."
	docker compose logs -f

# Clean artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -f kubetriage
	rm -rf frontend/dist
