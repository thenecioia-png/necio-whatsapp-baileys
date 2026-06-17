const { httpRequest } = require('../../utils/http');

function createPollinations(config) {
  const { aiTimeoutMs } = config;

  async function askPollinations(messages) {
    const data = JSON.stringify({
      model: 'openai',
      messages,
      temperature: 0.7,
      max_tokens: 250
    });

    const options = {
      hostname: 'text.pollinations.ai',
      path: '/openai',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askPollinations;
}

module.exports = createPollinations;
