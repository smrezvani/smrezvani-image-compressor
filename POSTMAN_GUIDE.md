# Postman Testing Guide for Image Compressor API

## Quick Start

### 1. Import Collection
1. Open Postman
2. Click "Import" button
3. Select the `postman-collection.json` file from this project
4. The collection "Image Compressor API" will be added to your workspace

### 2. Start the Server
```bash
# Without authentication (for testing)
ENABLE_AUTH=false npm run dev

# With authentication
ENABLE_AUTH=true API_KEY=your-secret-key npm run dev
```

## Testing Each Endpoint

### Health Check
- **No setup required**
- Just click "Send"
- Expected response: `{"status":"healthy","service":"image-compressor"}`

### Image Info Endpoint
1. **Prepare a base64 image**:
   - Option A: Use an online converter like [base64-image.de](https://www.base64-image.de/)
   - Option B: Use this command: `base64 -i your-image.jpg | pbcopy` (Mac) or `base64 your-image.jpg | xclip -selection clipboard` (Linux)
   
2. **Replace placeholder**:
   - In the request body, replace `YOUR_BASE64_IMAGE_STRING_HERE` with your base64 string
   
3. **Send request**:
   - Expected response: `{"width":1920,"height":1080}` (your actual dimensions)

### Compress Endpoints

#### Base64 Compression (/compress)
1. **Prepare base64 image** (same as above)
2. **Choose format and options**:
   ```json
   {
     "image": "YOUR_BASE64_STRING",
     "format": "mozjpeg",  // or "webp", "avif", "oxipng"
     "options": {
       "quality": 85  // 0-100 for lossy formats
     }
   }
   ```
3. **Response** contains:
   - `image`: Compressed image as base64
   - `size`: File size in bytes
   - `format`: Output format

#### File Upload (/compress/file)
1. **In Postman**:
   - Select "Body" → "form-data"
   - For "image" field, select "File" type
   - Click "Select Files" and choose your image
   - Set "format" field to desired output format
   - Set "options" field to JSON string like `{"quality":85}`
   
2. **Response**:
   - Binary image data (Postman will show preview)
   - Check response headers for content-type and size

### With Authentication

If `ENABLE_AUTH=true`:
1. **Enable the x-api-key header**:
   - In each request, find the "x-api-key" header
   - Uncheck "disabled"
   - Set value to your API key

2. **Or set globally**:
   - Go to collection variables
   - Set `apiKey` variable to your actual key
   - Update headers to use `{{apiKey}}`

## Sample Test Images

### Create Test Images with ImageMagick:
```bash
# Create a 1920x1080 test image
convert -size 1920x1080 xc:blue -pointsize 100 -fill white \
  -gravity center -annotate +0+0 "TEST IMAGE" test.jpg

# Convert to base64
base64 -i test.jpg > test-base64.txt
```

### Test Different Formats:
```bash
# Test JPEG compression
curl -X POST http://localhost:3000/compress \
  -H "Content-Type: application/json" \
  -d '{
    "image": "'$(base64 -i test.jpg)'",
    "format": "mozjpeg",
    "options": {"quality": 50}
  }' | jq '.size'

# Compare sizes for different qualities
for q in 30 50 70 90; do
  echo "Quality $q:"
  curl -s -X POST http://localhost:3000/compress \
    -H "Content-Type: application/json" \
    -d '{
      "image": "'$(base64 -i test.jpg)'",
      "format": "mozjpeg",
      "options": {"quality": '$q'}
    }' | jq '.size'
done
```

## Advanced Testing

### Test Resize Options
```json
{
  "image": "YOUR_BASE64",
  "format": "mozjpeg",
  "resize": {
    "enabled": true,
    "width": 400,
    "height": 300,
    "fitMethod": "contain",  // or "stretch"
    "method": "lanczos3"     // or "mitchell", "catrom"
  },
  "options": {
    "quality": 85
  }
}
```

### Test Format-Specific Options

#### WebP with Lossless:
```json
{
  "format": "webp",
  "options": {
    "lossless": true,
    "nearLossless": true,
    "effort": 6
  }
}
```

#### AVIF High Quality:
```json
{
  "format": "avif",
  "options": {
    "quality": 90,
    "lossless": false,
    "effort": 9
  }
}
```

#### PNG Optimization:
```json
{
  "format": "oxipng",
  "options": {
    "level": 6,
    "interlace": true,
    "effort": 10
  }
}
```

## Environment Setup in Postman

### Create Environments:
1. **Development** (no auth):
   ```
   baseUrl: http://localhost:3000
   authEnabled: false
   ```

2. **Production** (with auth):
   ```
   baseUrl: http://localhost:3000
   apiKey: your-production-key
   authEnabled: true
   ```

### Use in Requests:
- URL: `{{baseUrl}}/compress`
- Header: `x-api-key: {{apiKey}}`

## Performance Testing

### Test with Different Image Sizes:
```bash
# Small image (100KB)
# Medium image (1MB)  
# Large image (10MB)
```

### Measure Response Times:
In Postman, check the response time in the status bar after each request.

### Batch Testing Script:
```javascript
// Postman Pre-request Script
const qualities = [30, 50, 70, 90];
const currentQuality = qualities[pm.iterationData.get("index") || 0];
pm.variables.set("quality", currentQuality);
```

## Troubleshooting

### Common Issues:

1. **"API key is required"**
   - Enable the x-api-key header
   - Or set ENABLE_AUTH=false when starting server

2. **"Invalid API key"**
   - Check your API_KEY environment variable
   - Ensure the header value matches exactly

3. **"Image data required"**
   - Ensure base64 string is properly formatted
   - Remove any whitespace or line breaks

4. **Large Image Errors**
   - Default limit is 50MB
   - For larger images, adjust the limit in server configuration

5. **Format Not Supported**
   - Valid formats: mozjpeg, jpeg, webp, avif, oxipng, png
   - Note: JXL is not supported by Sharp library