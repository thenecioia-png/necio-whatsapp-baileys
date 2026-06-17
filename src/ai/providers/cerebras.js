const { httpRequest } = require('../../utils/http');

function createCerebras(config) {
  const { cerebrasApiKey, cerebrasModel, aiTimeoutMs } = config;

  async function askCerebras(messages) {
    if (!cerebrasApiKey) throw new Error('CEREBRAS_API_KEY no configurada');

    const data = JSON.stringify({
      model: cerebrasModel,
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const options = {
      hostname: 'api.cerebras.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cerebrasApiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askCerebras;
}

module.exports = createCerebras;
