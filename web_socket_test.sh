# web_socket_test.sh
#!/usr/bin/env bash
# =====================================================================
# WebSocket Chat Test Script for TuChati
# Logs in two users (admin & user2), retrieves JWT tokens,
# and opens wscat connections for both to the same chat room.
# =====================================================================

# --- Configuration ---
API_URL="http://localhost:8092/api/token/"
WS_URL="ws://localhost:8011/ws/chat"
# Predefined chat room ID you can as well (replace it with your actual room ID)
ROOM_ID="60ff1e6a-30d4-4093-8ea7-9d99bffeee01"

# --- Colors ---
GREEN='\033[0;32m'
# No Color
NC='\033[0m'

# --- Login and retrieve tokens ---
echo -e "${GREEN}🔐 Logging in admin...${NC}"
ACCESS_ADMIN=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"adminpass123"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access"])')

#--- Login user2 ---
echo -e "${GREEN}🔐 Logging in user2...${NC}"
ACCESS_USER2=$(curl -s -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{"username":"user2","password":"user2pass"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["access"])')

# --- Check results ---
if [ -z "$ACCESS_ADMIN" ] || [ -z "$ACCESS_USER2" ]; then
  echo "❌ Failed to retrieve tokens. Check API is running on port 8092."
  exit 1
fi

echo -e "\n${GREEN}✅ Admin Token:${NC} $ACCESS_ADMIN"
echo -e "${GREEN}✅ User2 Token:${NC} $ACCESS_USER2\n"

# --- Instructions ---
echo "=================================================================="
echo "🧩  Ready to test!"
echo "👉  In two separate terminals, run the following commands:"
echo "=================================================================="
echo -e "${GREEN}# Terminal 1 (Admin):${NC}"
echo "wscat -c \"${WS_URL}/${ROOM_ID}/?token=${ACCESS_ADMIN}\""
echo ""
echo -e "${GREEN}# Terminal 2 (User2):${NC}"
echo "wscat -c \"${WS_URL}/${ROOM_ID}/?token=${ACCESS_USER2}\""
echo ""
echo "=================================================================="
echo "Once connected, try sending messages in one terminal — they should"
echo "instantly appear in the other! 🚀"
echo "=================================================================="
