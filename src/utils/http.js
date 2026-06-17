const http = require('http');
const https = require('https');

function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' || !options.protocol ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          resolve({ status: res.statusCode, body: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });

    if (data) req.write(data);
    req.end();
  });
}

module.exports = { httpRequest };
