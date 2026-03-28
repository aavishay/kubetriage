.PHONY: all build run test clean

# Default target
all: build

# Build the final binary
build:
	@echo "🏗️  Building Frontend..."
	cd frontend && npm install --legacy-peer-deps && npm run build
	@echo "📦 Copying frontend dist for embedding..."
	rm -rf internal/ui/dist && cp -r frontend/dist internal/ui/dist
	@echo "🏗️  Building Go binary..."
	go build -o kubetriage cmd/server/main.go
	@echo "✅ Build complete! Run ./kubetriage to start."

# Run Local (Dev)
run:
	@echo "🚀 Starting KubeTriage..."
	go run ./cmd/server

# Clean artifacts
clean:
	@echo "🧹 Cleaning..."
	rm -f kubetriage cli kubetriage_bin
	rm -f server.log test_output.txt
	rm -f kubetriage.db*
	rm -rf internal/ui/dist
	rm -rf frontend/dist
