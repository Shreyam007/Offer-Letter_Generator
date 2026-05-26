import https from 'https';

const makeRequest = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
};

async function main() {
  try {
    console.log('1. Creating a campaign...');
    const campaignPostData = JSON.stringify({
      name: 'Candidates Upload Test ' + Date.now(),
      companyId: 'mock-company-quillon-id'
    });
    const campRes = await makeRequest({
      hostname: 'offer-letter-generator-whu4.onrender.com',
      port: 443,
      path: '/api/campaigns',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(campaignPostData)
      }
    }, campaignPostData);

    console.log('Campaign Response:', campRes.statusCode, campRes.body);
    const campaign = JSON.parse(campRes.body);

    console.log(`2. Uploading candidates to campaign ${campaign._id}...`);
    // Sample parsed candidate data (matching the schema and headers)
    const candidatesData = [
      {
        name: 'John Doe',
        email: 'john.doe@example.com',
        Phone: '1234567890',
        Organization: 'Quillon Markets',
        'Registration Date': '2026-05-26',
        'Payment Status': 'Paid',
        'Attendance Status': 'Present',
        Status: 'Active',
        AICTE_Code: 'ACT123',
        Role: 'Software Engineer Intern',
        Duration: '3 Months',
        'Start Date': '2026-06-01',
        Mode: 'Remote',
        Internship_Name: 'Web Dev',
        Partner_Name: 'AICTE'
      }
    ];

    const candidatesPostData = JSON.stringify(candidatesData);
    const candRes = await makeRequest({
      hostname: 'offer-letter-generator-whu4.onrender.com',
      port: 443,
      path: `/api/campaigns/${campaign._id}/candidates`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(candidatesPostData)
      }
    }, candidatesPostData);

    console.log('Candidates Response:', candRes.statusCode, candRes.body);
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
