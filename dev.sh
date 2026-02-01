#!/bin/bash

# Tomoe Kanji Recognizer - Development Server
# Usage: ./dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
DATA_FILE="$SRC_DIR/data/characters.json"
PORT="${PORT:-8080}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🖌️  Tomoe Kanji Recognizer - Dev Server${NC}"
echo "========================================"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: python3 is not installed${NC}"
    exit 1
fi

# Prepare data if needed
if [ ! -f "$DATA_FILE" ]; then
    echo -e "${YELLOW}📦 Data not found. Preparing...${NC}"
    
    # Clone tomoe_data if not exists
    if [ ! -d "$SCRIPT_DIR/temp_tomoe_data" ]; then
        echo "  → Cloning tomoe_data repository..."
        git clone --depth 1 https://github.com/hiroyuki-komatsu/tomoe_data.git "$SCRIPT_DIR/temp_tomoe_data"
    fi
    
    # Convert data
    echo "  → Converting data to JSON..."
    python3 "$SCRIPT_DIR/scripts/convert_data.py"
    
    # Cleanup
    echo "  → Cleaning up..."
    rm -rf "$SCRIPT_DIR/temp_tomoe_data"
    
    echo -e "${GREEN}✅ Data prepared successfully!${NC}"
else
    echo -e "${GREEN}✅ Data already prepared${NC}"
fi

# Get character count
CHAR_COUNT=$(grep -o '"char":' "$DATA_FILE" | wc -l | tr -d ' ')
echo -e "${BLUE}📚 Loaded $CHAR_COUNT characters${NC}"

# Start server
echo ""
echo -e "${GREEN}🚀 Starting development server...${NC}"
echo -e "   URL: ${YELLOW}http://localhost:$PORT${NC}"
echo -e "   Press ${YELLOW}Ctrl+C${NC} to stop"
echo ""

cd "$SRC_DIR"
python3 -m http.server "$PORT"
