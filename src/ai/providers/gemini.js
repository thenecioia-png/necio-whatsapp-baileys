const { httpRequest } = require('../../utils/http');

function createGemini(config) {
  const { geminiApiKey, geminiModel, aiTimeoutMs } = config;

  async function askGemini(messages) {
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY no configurada');

    const contents = [];
    let systemText = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemText += msg.content + '\n';
        continue;
      }
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    if (systemText && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = systemText + contents[0].parts[0].text;
    }

    const data = JSON.stringify({ contents });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
  }

  return askGemini;
}

module.exports = createGemini;
