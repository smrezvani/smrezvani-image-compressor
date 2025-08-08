#!/bin/bash

# Test Image Compressor API with automatic base64 encoding/decoding

API_URL="http://localhost:3000"
API_KEY="your-secure-api-key-here"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to encode image to base64
encode_image() {
  base64 -i "$1" 2>/dev/null || base64 "$1"
}

# Function to decode base64 to image
decode_base64() {
  echo "$1" | base64 -d 2>/dev/null || echo "$1" | base64 --decode
}

# Test compression
test_compress() {
  local input_image=$1
  local format=$2
  local quality=$3
  local output_image=$4
  
  echo -e "${BLUE}Testing compression:${NC}"
  echo "  Input: $input_image"
  echo "  Format: $format"
  echo "  Quality: $quality"
  echo "  Output: $output_image"
  
  # Encode image to base64 and save to temp file
  local temp_base64=$(mktemp /tmp/base64.XXXXXX)
  local temp_json=$(mktemp /tmp/request.XXXXXX)
  
  encode_image "$input_image" > "$temp_base64"
  
  # Create JSON request in a file
  cat > "$temp_json" <<EOF
{
  "image": "$(cat $temp_base64)",
  "format": "$format",
  "options": {"quality": $quality}
}
EOF
  
  # Make API request using the file
  local response=$(curl -s -X POST "$API_URL/compress" \
    -H "Content-Type: application/json" \
    -d @"$temp_json")
  
  # Clean up temp files
  rm -f "$temp_base64" "$temp_json"
  
  # Check if response contains error
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}❌ Error:${NC}"
    echo "$response" | jq '.'
    return 1
  fi
  
  # Extract base64 image from response and decode
  echo "$response" | jq -r '.image' | decode_base64 > "$output_image"
  
  # Get file sizes
  local original_size=$(ls -lh "$input_image" | awk '{print $5}')
  local compressed_size=$(ls -lh "$output_image" | awk '{print $5}')
  local api_size=$(echo "$response" | jq -r '.size')
  
  echo -e "${GREEN}✅ Success!${NC}"
  echo "  Original size: $original_size"
  echo "  Compressed size: $compressed_size"
  echo "  Compression ratio: $(echo "$response" | jq -r '.format')"
  echo "  Saved to: $output_image"
  echo ""
}

# Test with resize
test_resize() {
  local input_image=$1
  local width=$2
  local height=$3
  local output_image=$4
  
  echo -e "${BLUE}Testing resize:${NC}"
  echo "  Input: $input_image"
  echo "  Dimensions: ${width}x${height}"
  echo "  Output: $output_image"
  
  # Encode image to base64 and save to temp file
  local temp_base64=$(mktemp /tmp/base64.XXXXXX)
  local temp_json=$(mktemp /tmp/request.XXXXXX)
  
  encode_image "$input_image" > "$temp_base64"
  
  # Create JSON request in a file
  cat > "$temp_json" <<EOF
{
  "image": "$(cat $temp_base64)",
  "format": "mozjpeg",
  "resize": {
    "enabled": true,
    "width": $width,
    "height": $height,
    "fitMethod": "contain"
  },
  "options": {"quality": 85}
}
EOF
  
  # Make API request using the file
  local response=$(curl -s -X POST "$API_URL/compress" \
    -H "Content-Type: application/json" \
    -d @"$temp_json")
  
  # Clean up temp files
  rm -f "$temp_base64" "$temp_json"
  
  # Check if response contains error
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}❌ Error:${NC}"
    echo "$response" | jq '.'
    return 1
  fi
  
  echo "$response" | jq -r '.image' | decode_base64 > "$output_image"
  
  echo -e "${GREEN}✅ Resized and saved to: $output_image${NC}"
  echo ""
}

# Test file upload
test_file_upload() {
  local input_image=$1
  local format=$2
  local output_image=$3
  
  echo -e "${BLUE}Testing file upload:${NC}"
  echo "  Input: $input_image"
  echo "  Format: $format"
  echo "  Output: $output_image"
  
  curl -s -X POST "$API_URL/compress/file" \
    -F "image=@$input_image" \
    -F "format=$format" \
    -F 'options={"quality":85}' \
    -o "$output_image"
  
  echo -e "${GREEN}✅ Saved to: $output_image${NC}"
  echo ""
}

# Main menu
show_menu() {
  echo -e "${BLUE}==================================${NC}"
  echo -e "${BLUE}   Image Compressor API Tester   ${NC}"
  echo -e "${BLUE}==================================${NC}"
  echo ""
  echo "1) Test JPEG compression"
  echo "2) Test WebP compression"
  echo "3) Test AVIF compression"
  echo "4) Test PNG optimization"
  echo "5) Test resize with compression"
  echo "6) Test file upload"
  echo "7) Test all formats"
  echo "8) Exit"
  echo ""
}

# Check if server is running
check_server() {
  if ! curl -s "$API_URL/health" > /dev/null; then
    echo -e "${RED}❌ Server is not running!${NC}"
    echo "Please start the server with: npm run dev"
    exit 1
  fi
  echo -e "${GREEN}✅ Server is running${NC}"
  echo ""
}

# Main script
if [ $# -eq 0 ]; then
  echo "Usage: $0 <input-image>"
  echo "Example: $0 photo.jpg"
  exit 1
fi

INPUT_IMAGE=$1

if [ ! -f "$INPUT_IMAGE" ]; then
  echo -e "${RED}❌ File not found: $INPUT_IMAGE${NC}"
  exit 1
fi

check_server

while true; do
  show_menu
  read -p "Select option: " choice
  
  case $choice in
    1)
      test_compress "$INPUT_IMAGE" "mozjpeg" 85 "output_jpeg.jpg"
      ;;
    2)
      test_compress "$INPUT_IMAGE" "webp" 85 "output.webp"
      ;;
    3)
      test_compress "$INPUT_IMAGE" "avif" 60 "output.avif"
      ;;
    4)
      test_compress "$INPUT_IMAGE" "oxipng" 3 "output.png"
      ;;
    5)
      test_resize "$INPUT_IMAGE" 800 600 "output_resized.jpg"
      ;;
    6)
      test_file_upload "$INPUT_IMAGE" "mozjpeg" "output_upload.jpg"
      ;;
    7)
      test_compress "$INPUT_IMAGE" "mozjpeg" 85 "output_all_jpeg.jpg"
      test_compress "$INPUT_IMAGE" "webp" 85 "output_all.webp"
      test_compress "$INPUT_IMAGE" "avif" 60 "output_all.avif"
      test_compress "$INPUT_IMAGE" "oxipng" 3 "output_all.png"
      ;;
    8)
      echo "Goodbye!"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid option${NC}"
      ;;
  esac
  
  read -p "Press Enter to continue..."
done