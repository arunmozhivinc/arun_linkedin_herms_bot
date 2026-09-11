#!/bin/sh
set -e

# Ensure required runtime directories exist
mkdir -p /data/db /var/log/mongodb /app/data/images

# If MONGODB_URI is not provided, or contains localhost / 127.0.0.1, boot local MongoDB
if [ -z "$MONGODB_URI" ] || echo "$MONGODB_URI" | grep -q "localhost" || echo "$MONGODB_URI" | grep -q "127.0.0.1"; then
  echo "🚀 Starting embedded MongoDB Community Server daemon..."
  mongod --fork --dbpath /data/db --logpath /var/log/mongodb/mongod.log --bind_ip 127.0.0.1
  export MONGODB_URI="mongodb://127.0.0.1:27017/linkedin_hermes"
  echo "✅ Embedded MongoDB online at $MONGODB_URI"
else
  echo "📡 Connecting to external MongoDB cluster ($MONGODB_URI)..."
fi

echo "🌟 Launching LinkedIn Hermes AutoPilot NestJS platform..."
exec node dist/main.js

