import https from 'https';

const getUrl = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
};

async function main() {
  try {
    console.log('Fetching main Vercel page...');
    const html = await getUrl('https://frontend-nine-eta-67.vercel.app');
    
    // Search for script tags like /assets/index-DXeMQfz3.js
    const match = html.match(/\/assets\/index-[a-zA-Z0-9_\-]+\.js/);
    if (!match) {
      console.log('No JS bundle match found in HTML. HTML was:', html);
      return;
    }
    
    const bundleUrl = 'https://frontend-nine-eta-67.vercel.app' + match[0];
    console.log('Fetching JS bundle:', bundleUrl);
    const js = await getUrl(bundleUrl);
    
    console.log('Searching JS bundle...');
    const hasLocalhost = js.includes('localhost:5000');
    const hasRender = js.includes('offer-letter-generator-whu4.onrender.com');
    
    console.log('Contains "localhost:5000":', hasLocalhost);
    console.log('Contains "offer-letter-generator-whu4":', hasRender);
    
    // Find some snippets around API_BASE
    const localIdx = js.indexOf('localhost:5000');
    if (localIdx !== -1) {
      console.log('Snippet around localhost:5000:', js.substring(localIdx - 100, localIdx + 100));
    }
    const renderIdx = js.indexOf('offer-letter-generator-whu4');
    if (renderIdx !== -1) {
      console.log('Snippet around Render:', js.substring(renderIdx - 100, renderIdx + 100));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
