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
RUN CGO_ENABLED=0 GOOS=linux go build -o server cmd/server/main.go

# Stage 3: Final Runtime
FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates

# Copy Backend Binary
COPY --from=backend-builder /app/server .

# Copy Frontend Static Assets
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user and set permissions
RUN adduser -D -g '' appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3001
CMD ["./server"]
