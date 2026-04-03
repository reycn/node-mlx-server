#!/bin/bash
set -e

# MLX Inference Server - Development Startup Script
# Usage: ./dev.sh [--port PORT] [--host HOST]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)
      export MLX_PORT="$2"
      shift 2
      ;;
    --host)
      export MLX_HOST="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--port PORT] [--host HOST]"
      exit 1
      ;;
  esac
done

echo "Installing server dependencies..."
cd "$SERVER_DIR"
yarn install

echo ""
echo "Starting MLX inference server..."
cd "$SCRIPT_DIR"
npx tsx server/index.ts
