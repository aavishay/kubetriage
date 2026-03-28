#!/usr/bin/env bash
set -e

echo "Building KubeTriage..."

# Build Frontend
echo "Building React frontend..."
cd frontend
npm ci --ignore-scripts || npm install --ignore-scripts
npm run build
echo "Updating frontend assets in backend..."
rm -rf ../internal/ui/dist
cp -r dist ../internal/ui/dist
cd ..

# Build Backend
echo "Building Go backend..."
go mod download
go build -o kubetriage cmd/server/main.go

echo "Build complete! Binary located at ./kubetriage"
