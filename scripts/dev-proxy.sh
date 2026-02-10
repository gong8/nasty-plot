#!/usr/bin/env bash
# Start claude-max-api-proxy with auth check.
# If authentication fails, print instructions and exit non-zero.

set -euo pipefail

PORT="${LLM_PROXY_PORT:-3456}"

echo "Starting claude-max-api-proxy on port $PORT..."

# Check if claude CLI is authenticated before starting the server
if ! claude --version >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Claude CLI not found or not working."
  echo "Install it: npm install -g @anthropic-ai/claude-code"
  echo "Then authenticate: claude"
  exit 1
fi

# Try a quick auth check via the CLI
if ! claude --print-auth-status 2>/dev/null | grep -qi "authenticated\|logged in\|ok"; then
  # --print-auth-status may not exist; fall back to starting the proxy and checking output
  :
fi

# Start the proxy and monitor its output for auth errors
npx claude-max-api-proxy "$PORT" 2>&1 &
PROXY_PID=$!

# Give it a few seconds to start and check auth
sleep 3

if ! kill -0 "$PROXY_PID" 2>/dev/null; then
  echo ""
  echo "ERROR: claude-max-api-proxy failed to start."
  echo ""
  echo "This usually means Claude CLI authentication is missing or expired."
  echo "Fix it by running:"
  echo ""
  echo "  claude"
  echo ""
  echo "This will open a browser for OAuth login. Once authenticated, retry:"
  echo ""
  echo "  pnpm dev:all"
  echo ""
  exit 1
fi

# Proxy started successfully — wait for it to keep running
echo "claude-max-api-proxy running (PID $PROXY_PID) on port $PORT"
wait "$PROXY_PID"
