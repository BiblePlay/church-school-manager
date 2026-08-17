#!/bin/bash
cd "$(dirname "$0")"
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:$PORT") &
  python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:$PORT") &
  python -m SimpleHTTPServer "$PORT"
else
  echo "Python이 필요합니다."
  read -p "Enter를 누르면 종료합니다..."
fi
