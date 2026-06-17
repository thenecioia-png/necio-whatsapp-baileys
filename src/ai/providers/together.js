const { httpRequest } = require('../../utils/http');

function createTogether(config) {
  const { togetherApiKey, togetherModel, aiTimeoutMs } = config;

  async function askTogether(messages) {
    if (!togetherApiKey) throw new Error('TOGETHER_API_KEY no configurada');

    const data = JSON.stringify({
      model: togetherModel,
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const options = {
      hostname: 'api.together.xyz',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${togetherApiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askTogether;
}

module.exports = createTogether;
