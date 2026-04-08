.PHONY: all build run test clean release

# Variables
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -X main.version=$(VERSION) -s -w

# Platforms
PLATFORMS := darwin/amd64 darwin/arm64 linux/amd64 linux/arm64

# Default target
all: build

# Build the final binary (local platform)
build: build-frontend
	@echo "🏗️  Building Go binary..."
	go build -ldflags "$(LDFLAGS)" -o kubetriage cmd/server/main.go
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
	rm -rf dist/

# Build frontend assets
build-frontend:
	@echo "🏗️  Building Frontend..."
	cd frontend && npm install --legacy-peer-deps && npm run build
	@echo "📦 Copying frontend dist for embedding..."
	rm -rf internal/ui/dist && cp -r frontend/dist internal/ui/dist

# Cross-platform builds
.PHONY: build-all $(PLATFORMS)

build-all: build-frontend $(PLATFORMS)

$(PLATFORMS):
	@echo "🏗️  Building for $@..."
	@mkdir -p dist
	@GOOS=$(word 1,$(subst /, ,$@)) GOARCH=$(word 2,$(subst /, ,$@)) \
		go build -ldflags "$(LDFLAGS)" \
		-o dist/kubetriage-$(word 1,$(subst /, ,$@))-$(word 2,$(subst /, ,$@))$(if $(findstring windows,$(word 1,$(subst /, ,$@))),.exe,) \
		cmd/server/main.go
	@echo "✅ Built: dist/kubetriage-$@"

# Release build (all platforms)
release: clean build-frontend build-all
	@echo "📦 Creating release archives..."
	@for platform in $(PLATFORMS); do \
		os=$$(echo $$platform | cut -d'/' -f1); \
		arch=$$(echo $$platform | cut -d'/' -f2); \
		filename="kubetriage-$(VERSION)-$$os-$$arch"; \
		if [ "$$os" = "windows" ]; then \
			zip -j dist/$$filename.zip dist/kubetriage-$$os-$$arch.exe LICENSE README.md; \
		else \
			tar -czf dist/$$filename.tar.gz -C dist kubetriage-$$os-$$arch -C .. LICENSE README.md; \
		fi; \
		echo "✅ Created: dist/$$filename"; \
	done
	@echo "✅ Release complete! Check the dist/ directory."

# Check if all required tools are installed
check:
	@echo "🔍 Checking prerequisites..."
	@which go >/dev/null || (echo "❌ Go is not installed" && exit 1)
	@which node >/dev/null || (echo "❌ Node.js is not installed" && exit 1)
	@echo "✅ All prerequisites met!"
