#!/usr/bin/env node
/**
 * Test script to reproduce and debug the JSON parse error
 * Run: node test-json-error.js
 */

const http = require('http');

// Test 1: Valid JSON
console.log('Test 1: Sending valid JSON to /tts-labs...');
const validJSON = JSON.stringify({
  text: 'Hello, this is a test',
  voiceId: '21m00Tcm4TlvDq8ikWAM',
  model_id: 'eleven_turbo_v2'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/tts-labs',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(validJSON),
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    console.log('Response body:', data);
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(validJSON);
req.end();

// Test 2: Invalid JSON (object sent directly) - this should cause the error
setTimeout(() => {
  console.log('\nTest 2: Sending INVALID data (object string representation)...');
  
  const invalidData = '[object Object]'; // This is what causes the error
  
  const req2 = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', data);
    });
  });

  req2.on('error', (error) => {
    console.error('Request error:', error);
  });

  req2.write(invalidData);
  req2.end();
}, 1000);
