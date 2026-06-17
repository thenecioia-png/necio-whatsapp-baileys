const http = require('http');
const https = require('https');
const { URL } = require('url');

function createN8n(config) {
  const { n8nWebhookUrl } = config;

  async function sendToN8N(payload) {
    if (!n8nWebhookUrl) return;
    try {
      const data = JSON.stringify(payload);
      const url = new URL(n8nWebhookUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 5000
      };

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[→] n8n OK (${res.statusCode})`);
          }
        });
      });

      req.on('error', () => {});
      req.write(data);
      req.end();
    } catch (err) {}
  }

  return { sendToN8N };
}

module.exports = createN8n;
