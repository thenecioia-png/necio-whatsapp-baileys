const http = require('http');
const https = require('https');

function createKeepAlive(config, context, deps) {
  const { keepAliveUrl, selfPingIntervalMs, whatsappReconnectOnPing } = config;

  function startKeepAlive() {
    if (context.keepAliveInterval) {
      clearInterval(context.keepAliveInterval);
    }

    context.keepAliveInterval = setInterval(async () => {
      try {
        const url = keepAliveUrl;
        const start = Date.now();
        const client = url.startsWith('https:') ? https : http;

        await new Promise((resolve, reject) => {
          const req = client.get(url, { timeout: 15000 }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data));
          });
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });

        context.lastSelfPing = Date.now();
        const elapsed = Date.now() - start;
        console.log(`[💓] Self-ping OK (${elapsed}ms) → ${url}`);
      } catch (err) {
        console.error(`[💓] Self-ping falló:`, err.message);
      }
    }, selfPingIntervalMs);

    console.log(`[💓] Keep-alive activado. Self-ping cada ${selfPingIntervalMs / 60000} min a: ${keepAliveUrl}`);
  }

  return { startKeepAlive };
}

module.exports = createKeepAlive;
