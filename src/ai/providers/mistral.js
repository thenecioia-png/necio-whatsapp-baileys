const { httpRequest } = require('../../utils/http');

function createMistral(config) {
  const { mistralApiKey, mistralModel, aiTimeoutMs } = config;

  async function askMistral(messages) {
    if (!mistralApiKey) throw new Error('MISTRAL_API_KEY no configurada');

    const data = JSON.stringify({
      model: mistralModel,
      messages,
      max_tokens: 200
    });

    const options = {
      hostname: 'api.mistral.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askMistral;
}

module.exports = createMistral;
