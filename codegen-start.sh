#!/bin/bash
# Starts playwright codegen and tiles browser + Inspector side by side using xdotool
URL="$1"
OUTPUT="$2"

export DISPLAY="${DISPLAY:-:99}"

# Launch codegen in background
npx playwright codegen "$URL" --output "$OUTPUT" --target playwright-test &
CODEGEN_PID=$!

# Wait for windows to appear, then tile them
(
  sleep 5
  # Find browser window (chromium)
  BROWSER=$(xdotool search --onlyvisible --class chromium 2>/dev/null | head -1)
  # Find Inspector window by name
  INSPECTOR=$(xdotool search --onlyvisible --name "Playwright" 2>/dev/null | grep -v "^$BROWSER$" | head -1)

  if [ -n "$BROWSER" ]; then
    xdotool windowmove "$BROWSER" 0 0
    xdotool windowsize "$BROWSER" 1060 1040
  fi
  if [ -n "$INSPECTOR" ]; then
    xdotool windowmove "$INSPECTOR" 1060 0
    xdotool windowsize "$INSPECTOR" 860 1040
  fi
) &

wait $CODEGEN_PID
