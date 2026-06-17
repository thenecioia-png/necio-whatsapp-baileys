const { httpRequest } = require('../../utils/http');

function createGitHubModels(config) {
  const { githubModelsToken, githubModelsModel, aiTimeoutMs } = config;

  async function askGitHubModels(messages) {
    if (!githubModelsToken) throw new Error('GITHUB_MODELS_TOKEN no configurada');

    const data = JSON.stringify({
      model: githubModelsModel,
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const options = {
      hostname: 'models.inference.ai.azure.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubModelsToken}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: aiTimeoutMs
    };

    const res = await httpRequest(options, data);
    return res.body?.choices?.[0]?.message?.content || null;
  }

  return askGitHubModels;
}

module.exports = createGitHubModels;
