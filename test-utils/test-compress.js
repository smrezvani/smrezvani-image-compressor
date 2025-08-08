#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  yellow: '\x1b[33m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function makeRequest(endpoint, data = null, method = 'POST', headers = {}) {
  const url = new URL(endpoint, API_URL);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      headers: {
        ...headers
      }
    };

    if (method === 'POST' && data) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    if (API_KEY) {
      options.headers['x-api-key'] = API_KEY;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve(json);
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

async function compressImage(imagePath, format = 'mozjpeg', options = {}, resize = null) {
  try {
    // Read and encode image
    log(`\n📸 Processing: ${imagePath}`, 'blue');
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const originalSize = fs.statSync(imagePath).size;
    
    log(`Original size: ${formatBytes(originalSize)}`, 'yellow');
    
    // Prepare request
    const requestData = {
      image: base64Image,
      format: format,
      options: options
    };
    
    if (resize) {
      requestData.resize = resize;
    }
    
    // Make API request
    log('🚀 Sending to API...', 'blue');
    const response = await makeRequest('/compress', JSON.stringify(requestData), 'POST');
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Decode and save result
    const outputBuffer = Buffer.from(response.image, 'base64');
    const outputPath = path.join(
      path.dirname(imagePath),
      `compressed_${Date.now()}_${path.basename(imagePath, path.extname(imagePath))}.${format === 'mozjpeg' ? 'jpg' : format}`
    );
    
    fs.writeFileSync(outputPath, outputBuffer);
    
    // Show results
    log('✅ Success!', 'green');
    log(`Compressed size: ${formatBytes(response.size)}`, 'yellow');
    log(`Compression ratio: ${((1 - response.size / originalSize) * 100).toFixed(1)}% reduction`, 'green');
    log(`Saved to: ${outputPath}`, 'blue');
    
    return outputPath;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function testAllFormats(imagePath) {
  const formats = [
    { name: 'mozjpeg', options: { quality: 85 } },
    { name: 'webp', options: { quality: 85 } },
    { name: 'avif', options: { quality: 60 } },
    { name: 'oxipng', options: { level: 3 } }
  ];
  
  log('\n🎨 Testing all formats...', 'blue');
  
  for (const format of formats) {
    await compressImage(imagePath, format.name, format.options);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Image Compressor CLI Test Tool

Usage:
  node test-compress.js <image> [options]

Options:
  --format <format>    Output format (mozjpeg, webp, avif, oxipng)
  --quality <number>   Quality 0-100 (for lossy formats)
  --width <number>     Resize width
  --height <number>    Resize height
  --all                Test all formats

Examples:
  # Basic compression
  node test-compress.js photo.jpg --format mozjpeg --quality 85
  
  # With resize
  node test-compress.js photo.jpg --format webp --width 800 --height 600
  
  # Test all formats
  node test-compress.js photo.jpg --all

Environment Variables:
  API_URL=${API_URL}
  API_KEY=${API_KEY}
    `);
    process.exit(0);
  }
  
  const imagePath = args[0];
  
  if (!fs.existsSync(imagePath)) {
    log(`❌ File not found: ${imagePath}`, 'red');
    process.exit(1);
  }
  
  // Parse arguments
  let format = 'mozjpeg';
  let options = { quality: 85 };
  let resize = null;
  let testAll = false;
  
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--format':
        format = args[++i];
        break;
      case '--quality':
        options.quality = parseInt(args[++i]);
        break;
      case '--width':
        if (!resize) resize = { enabled: true };
        resize.width = parseInt(args[++i]);
        break;
      case '--height':
        if (!resize) resize = { enabled: true };
        resize.height = parseInt(args[++i]);
        break;
      case '--all':
        testAll = true;
        break;
    }
  }
  
  // Check if server is running
  try {
    await makeRequest('/health', null, 'GET');
  } catch (error) {
    log('❌ Server is not running! Start it with: npm run dev', 'red');
    log(`Error details: ${error.message}`, 'red');
    process.exit(1);
  }
  
  // Execute compression
  if (testAll) {
    await testAllFormats(imagePath);
  } else {
    await compressImage(imagePath, format, options, resize);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { compressImage, testAllFormats };