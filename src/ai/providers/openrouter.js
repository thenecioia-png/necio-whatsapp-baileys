const { httpRequest } = require('../../utils/http');

function createOpenRouter(config) {
  const { openRouterApiKey, openRouterModel, aiTimeoutMs } = config;

  async function askOpenRouter(messages) {
    if (!openRouterApiKey) throw new Error('OPENROUTER_API_KEY no configurada');

    const data = JSON.stringify({
      model: openRouterModel,
      messages,
      max_tokens: 200
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': 'https://necio-digital.com',
        'X-Title': 'Necio WhatsApp Bot',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askOpenRouter;
}

module.exports = createOpenRouter;
