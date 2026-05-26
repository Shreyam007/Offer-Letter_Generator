import https from 'https';

const postData = JSON.stringify({
  name: 'Test Campaign ' + Date.now(),
  companyId: 'mock-company-quillon-id'
});

const options = {
  hostname: 'offer-letter-generator-whu4.onrender.com',
  port: 443,
  path: '/api/campaigns',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response Body:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
