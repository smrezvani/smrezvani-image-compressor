#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const command = process.argv[2];
const inputFile = process.argv[3];
const outputFile = process.argv[4];

function encodeImage(imagePath) {
  const image = fs.readFileSync(imagePath);
  return image.toString('base64');
}

function decodeImage(base64String, outputPath) {
  const buffer = Buffer.from(base64String, 'base64');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Image saved to: ${outputPath}`);
}

function help() {
  console.log(`
Base64 Image Helper

Usage:
  node base64-helper.js encode <input-image> [output-file]
  node base64-helper.js decode <base64-file> <output-image>
  node base64-helper.js decode-string "<base64-string>" <output-image>

Examples:
  # Encode image to base64
  node base64-helper.js encode photo.jpg photo-base64.txt
  
  # Decode base64 file to image
  node base64-helper.js decode photo-base64.txt decoded.jpg
  
  # Decode base64 string directly
  node base64-helper.js decode-string "/9j/4AAQSkZJRg..." output.jpg
  `);
}

switch(command) {
  case 'encode':
    if (!inputFile) {
      console.error('❌ Please provide an input image file');
      help();
      process.exit(1);
    }
    try {
      const encoded = encodeImage(inputFile);
      if (outputFile) {
        fs.writeFileSync(outputFile, encoded);
        console.log(`✅ Base64 saved to: ${outputFile}`);
      } else {
        console.log(encoded);
      }
    } catch (error) {
      console.error(`❌ Error encoding: ${error.message}`);
    }
    break;

  case 'decode':
    if (!inputFile || !outputFile) {
      console.error('❌ Please provide input base64 file and output image file');
      help();
      process.exit(1);
    }
    try {
      const base64String = fs.readFileSync(inputFile, 'utf8').trim();
      decodeImage(base64String, outputFile);
    } catch (error) {
      console.error(`❌ Error decoding: ${error.message}`);
    }
    break;

  case 'decode-string':
    if (!inputFile || !outputFile) {
      console.error('❌ Please provide base64 string and output image file');
      help();
      process.exit(1);
    }
    try {
      decodeImage(inputFile, outputFile);
    } catch (error) {
      console.error(`❌ Error decoding: ${error.message}`);
    }
    break;

  default:
    help();
}