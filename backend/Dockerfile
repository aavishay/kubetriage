# Build Stage
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o server cmd/server/main.go

# Runtime Stage
FROM alpine:latest
WORKDIR /app
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/server .
# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

EXPOSE 3001
CMD ["./server"]
