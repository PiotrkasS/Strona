#!/bin/bash

echo "[display] Starting Xvfb on :99..."
Xvfb :99 -screen 0 1280x900x24 -ac +extension RANDR &
sleep 2   # wait for Xvfb to be ready
export DISPLAY=:99
echo "[display] DISPLAY=$DISPLAY"

# x11vnc – VNC server (optional, errors are non-fatal)
if command -v x11vnc &>/dev/null; then
    echo "[vnc] Starting x11vnc on port 5900..."
    x11vnc -display :99 -nopw -listen 0.0.0.0 -rfbport 5900 -forever -quiet &
    sleep 1
else
    echo "[vnc] x11vnc not found, skipping"
fi

# noVNC – browser-based viewer (optional)
NOVNC_LAUNCHED=0
for SCRIPT in \
    /usr/share/novnc/utils/novnc_proxy \
    /usr/share/novnc/utils/launch.sh; do
    if [ -x "$SCRIPT" ]; then
        echo "[novnc] Starting on port 7900 via $SCRIPT..."
        "$SCRIPT" --vnc localhost:5900 --listen 7900 &
        NOVNC_LAUNCHED=1
        break
    fi
done
[ $NOVNC_LAUNCHED -eq 0 ] && echo "[novnc] Not found – browser preview unavailable"

echo "[php] Starting server on port 8000..."
exec php -S 0.0.0.0:8000 router.php
