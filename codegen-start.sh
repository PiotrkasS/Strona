#!/bin/bash
URL="$1"
OUTPUT="$2"

export DISPLAY="${DISPLAY:-:99}"

# Launch codegen with smaller viewport so Inspector panel at bottom is visible
npx playwright codegen \
  --viewport-size="960,720" \
  "$URL" \
  --output "$OUTPUT" \
  --target playwright-test &
CODEGEN_PID=$!

# Wait for windows, then tile browser LEFT and Inspector/Codegen popup RIGHT
(
  MAX_TRIES=12
  BROWSER=""
  INSPECTOR=""

  # Retry finding windows for up to 12 seconds
  for i in $(seq 1 $MAX_TRIES); do
    sleep 1
    [ -z "$BROWSER" ] && BROWSER=$(xdotool search --onlyvisible --class chromium 2>/dev/null | head -1)

    if [ -n "$BROWSER" ] && [ -z "$INSPECTOR" ]; then
      # Look for Playwright Codegen popup window (separate from the browser)
      for WIN in $(xdotool search --onlyvisible --name "" 2>/dev/null); do
        [ "$WIN" = "$BROWSER" ] && continue
        TITLE=$(xdotool getwindowname "$WIN" 2>/dev/null)
        if echo "$TITLE" | grep -Eqi "playwright|codegen|inspector|recorder"; then
          INSPECTOR="$WIN"
          break
        fi
      done
    fi

    [ -n "$BROWSER" ] && [ -n "$INSPECTOR" ] && break
  done

  # Position: browser on left half, Inspector on right half
  if [ -n "$BROWSER" ]; then
    xdotool windowmove  "$BROWSER" 0 0
    xdotool windowsize  "$BROWSER" 980 1060
    xdotool windowfocus "$BROWSER"
    xdotool windowraise "$BROWSER"
  fi

  if [ -n "$INSPECTOR" ]; then
    xdotool windowmove  "$INSPECTOR" 980 0
    xdotool windowsize  "$INSPECTOR" 940 1060
    xdotool windowraise "$INSPECTOR"
  else
    # Fallback: just make browser smaller so bottom Inspector panel is fully visible
    [ -n "$BROWSER" ] && xdotool windowsize "$BROWSER" 1400 900
  fi
) &

wait $CODEGEN_PID
