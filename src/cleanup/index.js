function createCleanup(config, context) {
  const { cleanupIntervalMs } = config;

  function cleanupOldData() {
    const now = Date.now();
    let cleanedConv = 0;
    let cleanedRate = 0;

    if (context.conversations.size > 500) {
      const entries = Array.from(context.conversations.entries());
      const toDelete = entries.slice(0, entries.length - 500);
      for (const [key] of toDelete) {
        context.conversations.delete(key);
        cleanedConv++;
      }
    }

    for (const [userId, timestamp] of context.rateLimits.entries()) {
      if (now - timestamp > 3600000) {
        context.rateLimits.delete(userId);
        cleanedRate++;
      }
    }

    if (cleanedConv > 0 || cleanedRate > 0) {
      console.log(`[🧹] Limpieza: ${cleanedConv} conversaciones, ${cleanedRate} rate limits`);
    }
  }

  if (!config.disableTimers) {
    setInterval(cleanupOldData, cleanupIntervalMs);
  }

  return { cleanupOldData };
}

module.exports = createCleanup;
