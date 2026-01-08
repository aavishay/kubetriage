#!/bin/bash

# Load .env variables if present
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Override for Local Execution (connecting to Docker services)
export DATABASE_URL="host=localhost user=kubetriage password=kubetriage dbname=kubetriage port=5433 sslmode=disable"
export REDIS_ADDR="localhost:6379"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4317"
export PORT=3001
export FRONTEND_URL="http://localhost:3000"
export GOOGLE_REDIRECT_URL="http://localhost:8081/api/auth/google/callback"
export MOCK_OIDC="true"

# Ensure KUBECONFIG is set (defaults to ~/.kube/config if unset)
if [ -z "$KUBECONFIG" ]; then
  export KUBECONFIG=$HOME/.kube/config
fi

echo "🚀 Starting KubeTriage Backend (Local Mode)"
echo "   - Database: $DATABASE_URL"
echo "   - Redis:    $REDIS_ADDR"
echo "   - Config:   $KUBECONFIG"

# Run the server
go run cmd/server/main.go
