# Image Compressor API Server

A TypeScript-based REST API server for image compression and optimization using Sharp library.

## Features

- Full TypeScript implementation with strict type safety
- API key authentication via `x-api-key` header
- Support for multiple image formats (JPEG, WebP, AVIF, PNG, JXL)
- Image resizing and preprocessing
- Docker support with multi-stage builds
- Base64 and file upload support

## Supported Formats

- **mozjpeg/jpeg**: JPEG compression with mozjpeg optimization
- **webp**: WebP format with lossless and lossy options
- **avif**: AVIF format for modern browsers
- **oxipng/png**: PNG optimization
- **Note**: JXL format removed (not supported by Sharp)

## API Endpoints

### Health Check

```bash
GET /health
```

### Get Image Info

```bash
POST /info
Headers: x-api-key: your-api-key (optional based on ENABLE_AUTH)
Body: { "image": "base64_string" }
```

### Compress Image (Base64)

```bash
POST /compress
Headers: x-api-key: your-api-key (optional based on ENABLE_AUTH)
Body: {
  "image": "base64_string",
  "format": "mozjpeg",
  "options": { "quality": 75 },
  "resize": { "enabled": true, "width": 800 }
}
```

### Compress Image (File Upload)

```bash
POST /compress/file
Headers: x-api-key: your-api-key (optional based on ENABLE_AUTH)
Form Data:
  - image: file
  - format: "mozjpeg"
  - options: JSON string
```

## Installation

### Local Development

1. Install dependencies:

```bash
npm install
```

1. Build TypeScript:

```bash
npm run build
```

1. Set environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

1. Run the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### Docker

1. Build the image:

```bash
docker-compose build
```

1. Run with Docker Compose:

```bash
# Set API_KEY environment variable
export API_KEY=your-secure-api-key-here
docker-compose up
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `ENABLE_AUTH`: Enable API key authentication (true/false, default: true)
- `API_KEY`: API key for authentication
- `NODE_ENV`: Node environment (development/production)

## Type Safety

This project uses TypeScript with strict mode enabled, ensuring:

- No implicit `any` types
- Strict null checks
- All function parameters and returns are typed
- Complete type coverage for all API requests/responses

## Testing with Postman

A complete Postman collection is included for easy API testing:

1. **Import Collection**: Import `postman-collection.json` into Postman
2. **Start Server**: Run `ENABLE_AUTH=false npm run dev` for testing
3. **Test Endpoints**: Use the pre-configured requests in the collection

See [POSTMAN_GUIDE.md](./POSTMAN_GUIDE.md) for detailed testing instructions, examples, and troubleshooting.

### Quick Test Example
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test compression with base64 image
curl -X POST http://localhost:3000/compress \
  -H "Content-Type: application/json" \
  -d '{
    "image": "YOUR_BASE64_IMAGE",
    "format": "mozjpeg",
    "options": {"quality": 85}
  }'
```

## Scripts

- `npm run build`: Build TypeScript to JavaScript
- `npm start`: Start the production server
- `npm run dev`: Start development server with ts-node
- `npm run watch`: Watch TypeScript files for changes
- `npm run typecheck`: Type check without building
- `npm run clean`: Clean build directory
