const { getCacheKey } = require('../utils/helpers');

function createCache(config, context) {
  const { cacheMaxAgeMs, cacheMaxEntries } = config;

  function getCachedReply(text) {
    const key = getCacheKey(text);
    const entry = context.responseCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > cacheMaxAgeMs) {
      context.responseCache.delete(key);
      return null;
    }
    console.log(`[💾] Cache hit: "${key.substring(0, 40)}..."`);
    return entry.reply;
  }

  function setCachedReply(text, reply) {
    const key = getCacheKey(text);
    if (context.responseCache.size >= cacheMaxEntries) {
      const firstKey = context.responseCache.keys().next().value;
      context.responseCache.delete(firstKey);
    }
    context.responseCache.set(key, { reply, timestamp: Date.now() });
  }

  return { getCachedReply, setCachedReply };
}

module.exports = createCache;
