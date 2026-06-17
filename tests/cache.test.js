const { describe, it } = require('node:test');
const assert = require('node:assert');
const createCache = require('../src/cache');

describe('cache', () => {
  it('caches and retrieves replies', () => {
    const context = { responseCache: new Map() };
    const cache = createCache({ cacheMaxAgeMs: 60000, cacheMaxEntries: 10 }, context);

    assert.strictEqual(cache.getCachedReply('hola'), null);
    cache.setCachedReply('hola', '¡Hola!');
    assert.strictEqual(cache.getCachedReply('hola'), '¡Hola!');
  });

  it('evicts old entries when max reached', () => {
    const context = { responseCache: new Map() };
    const cache = createCache({ cacheMaxAgeMs: 60000, cacheMaxEntries: 2 }, context);

    cache.setCachedReply('a', '1');
    cache.setCachedReply('b', '2');
    cache.setCachedReply('c', '3');

    assert.strictEqual(context.responseCache.size, 2);
  });
});
