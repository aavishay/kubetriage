#!/bin/bash
set -e

# --- Configuration ---
ROOT_DIR=$(pwd)
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR"
BINARY_NAME="kubetriage"

# --- Build Process ---

echo "🚀 Building KubeTriage..."

# 1. Build Frontend
echo "📦 Building frontend..."
cd "$FRONTEND_DIR"
npm ci --ignore-scripts || npm install --legacy-peer-deps
npm run build

# 2. Prepare Backend Assets
echo "📂 Syncing assets to backend..."
rm -rf "$BACKEND_DIR/internal/ui/dist"
cp -r "$FRONTEND_DIR/dist" "$BACKEND_DIR/internal/ui/dist"
cd "$BACKEND_DIR"

# 3. Build Backend CLI
echo "🏗️  Building backend CLI..."
go mod download
go build -o "$BINARY_NAME" cmd/server/main.go

echo "✅ Build complete! You can now run:"
echo "   ./$BINARY_NAME serve"
