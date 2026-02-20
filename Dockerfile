# Stage 1: Build Frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ .
RUN npm run build

# Stage 2: Build Backend
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Embed the compiled frontend into the Go binary
COPY --from=frontend-builder /app/frontend/dist ./internal/ui/dist
RUN CGO_ENABLED=0 GOOS=linux go build -o server cmd/server/main.go

# Stage 3: Final Runtime
FROM debian:bookworm-slim
WORKDIR /app

# Install base dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Google Cloud SDK & GKE Auth Plugin
RUN echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] http://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
    && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg \
    && apt-get update && apt-get install -y \
    google-cloud-sdk \
    google-cloud-sdk-gke-gcloud-auth-plugin \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install AWS CLI
RUN apt-get update && apt-get install -y awscli && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy Backend Binary
COPY --from=backend-builder /app/server .

# Copy Frontend Static Assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user and set permissions
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser
ENV HOME=/home/appuser

EXPOSE 3001
CMD ["./server"]
