#!/bin/bash
set -e

echo "Note: Using your existing environment variables for database connections."

# 1. Build Frontend
echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 2. Prepare Embedding
echo "Copying frontend assets..."
rm -rf internal/ui/dist
cp -r frontend/dist internal/ui/dist

# 3. Build Backend Binary
echo "Building kubetriage binary..."
export CGO_ENABLED=0
go build -o kubetriage cmd/server/main.go

echo "Build complete! You can now run ./kubetriage"
