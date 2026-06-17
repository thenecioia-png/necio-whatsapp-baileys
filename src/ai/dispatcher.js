function createDispatcher(config, context, deps) {
  const { aiTimeoutMs } = config;
  const { isCircuitOpen, recordFailure, recordSuccess } = deps.circuitBreaker;
  const { getCachedReply, setCachedReply } = deps.cache;

  async function askAI(messages) {
    const userMessage = messages[messages.length - 1]?.content || '';
    const cached = getCachedReply(userMessage);
    if (cached) return { reply: cached, provider: 'cache' };

    const providers = [
      { name: 'cerebras', fn: deps.askCerebras, available: !!config.cerebrasApiKey },
      { name: 'groq', fn: deps.askGroq, available: !!config.groqApiKey },
      { name: 'gemini', fn: deps.askGemini, available: !!config.geminiApiKey },
      { name: 'openrouter', fn: deps.askOpenRouter, available: !!config.openRouterApiKey },
      { name: 'together', fn: deps.askTogether, available: !!config.togetherApiKey },
      { name: 'github', fn: deps.askGitHubModels, available: !!config.githubModelsToken },
      { name: 'mistral', fn: deps.askMistral, available: !!config.mistralApiKey },
      { name: 'pollinations', fn: deps.askPollinations, available: true },
    ].filter(p => p.available);

    if (providers.length === 0) {
      console.error('[!] Ninguna API de IA está configurada');
      return { reply: null, provider: null };
    }

    for (const provider of providers) {
      if (isCircuitOpen(provider.name)) {
        console.log(`[⚡] ${provider.name.toUpperCase()} en circuito abierto, saltando...`);
        continue;
      }

      console.log(`[🤖] Intentando ${provider.name.toUpperCase()}...`);
      const startTime = Date.now();

      try {
        const reply = await Promise.race([
          provider.fn(messages),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), aiTimeoutMs)
          )
        ]);

        if (reply && reply.trim().length > 0) {
          const duration = Date.now() - startTime;
          console.log(`[✅] ${provider.name.toUpperCase()} respondió en ${duration}ms`);
          recordSuccess(provider.name);
          setCachedReply(userMessage, reply);
          return { reply, provider: provider.name };
        }
      } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`[❌] ${provider.name.toUpperCase()} falló (${duration}ms): ${err.message}`);
        recordFailure(provider.name);
      }
    }

    console.error('[☠️] TODAS las IAs fallaron. Activando respuesta de emergencia.');
    return { reply: null, provider: null };
  }

  return { askAI };
}

module.exports = createDispatcher;
