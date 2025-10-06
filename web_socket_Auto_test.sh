#!/usr/bin/env bash
# =====================================================================
# WebSocket Chat Test Script for TuChati (macOS compatible)
# Logs in two users, retrieves JWT tokens, and simulates chat messages.
# =====================================================================

API_URL="http://localhost:8092/api/token/"
WS_URL="ws://localhost:8011/ws/chat"
ROOM_ID="60ff1e6a-30d4-4093-8ea7-9d99bffeee01"

GREEN='\033[0;32m'
NC='\033[0m'

# --- Check dependencies ---
if ! command -v websocat &>/dev/null; then
  echo -e "❌ websocat not found!"
  echo "Install it with: brew install websocat"
  exit 1
fi

# --- Login users and get tokens ---
echo -e "${GREEN}🔐 Logging in admin...${NC}"
ACCESS_ADMIN=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass123"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access"])')

echo -e "${GREEN}🔐 Logging in user2...${NC}"
ACCESS_USER2=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"username":"user2","password":"user2pass"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access"])')

if [ -z "$ACCESS_ADMIN" ] || [ -z "$ACCESS_USER2" ]; then
  echo "❌ Failed to retrieve tokens. Ensure backend API is running."
  exit 1
fi

echo -e "\n${GREEN}✅ Admin Token:${NC} $ACCESS_ADMIN"
echo -e "${GREEN}✅ User2 Token:${NC} $ACCESS_USER2\n"

# --- Simulated chat ---
echo -e "${GREEN}🧪 Starting automated WebSocket chat test...${NC}\n"

# Function to send a message via websocat (macOS-safe)
send_ws() {
  local token=$1
  local message=$2
  echo -e "${GREEN}💬 Sending:${NC} ${message}"
  echo "$message" | websocat --no-close -q "${WS_URL}/${ROOM_ID}/?token=${token}" -
}

# --- Simulate conversation ---
send_ws "$ACCESS_ADMIN" "Hello user2 👋 from admin!"
sleep 2
send_ws "$ACCESS_USER2" "Hey admin 🙌, I received your message!"
sleep 2
send_ws "$ACCESS_ADMIN" '{"type":"typing"}'
sleep 2
send_ws "$ACCESS_USER2" '{"type":"read_receipt"}'

echo -e "\n✅ Test completed successfully!"
echo "You can verify logs in Django or check DB (Message table)."
echo "=================================================================="
echo "To test manually in live mode, run these:"
echo "wscat -c \"${WS_URL}/${ROOM_ID}/?token=${ACCESS_ADMIN}\""
echo "wscat -c \"${WS_URL}/${ROOM_ID}/?token=${ACCESS_USER2}\""
echo "=================================================================="
