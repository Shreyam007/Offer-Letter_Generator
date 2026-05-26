import https from 'https';

const options = {
  hostname: 'offer-letter-generator-whu4.onrender.com',
  port: 443,
  path: '/api/campaigns',
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://frontend-nine-eta-67.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log('Response Headers:', res.headers);
});

req.on('error', (e) => {
  console.error(`Problem: ${e.message}`);
});

req.end();
