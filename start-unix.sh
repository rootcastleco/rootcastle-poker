#!/usr/bin/env sh
set -eu
echo "Rootcastle Poker: http://127.0.0.1:8787"
exec node dist/server.js
