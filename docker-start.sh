#!/bin/bash
set -e

# Start virtual display (invisible screen for the browser)
Xvfb :99 -screen 0 1280x900x24 &
export DISPLAY=:99

# Start VNC server pointing at the virtual display
x11vnc -display :99 -nopw -listen 0.0.0.0 -rfbport 5900 -forever -quiet &

# Start noVNC (browser-based VNC viewer) on port 7900
/usr/share/novnc/utils/novnc_proxy \
    --vnc localhost:5900 \
    --listen 7900 \
    --web /usr/share/novnc &

# Start PHP app server
exec php -S 0.0.0.0:8000 router.php
