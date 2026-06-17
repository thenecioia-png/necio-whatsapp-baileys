const { httpRequest } = require('../../utils/http');

function createGroq(config) {
  const { groqApiKey, groqModel, aiTimeoutMs } = config;

  async function askGroq(messages) {
    if (!groqApiKey) throw new Error('GROQ_API_KEY no configurada');

    const data = JSON.stringify({
      model: groqModel,
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askGroq;
}

module.exports = createGroq;
