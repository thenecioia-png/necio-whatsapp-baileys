const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const createAntiBan = require('../src/anti-ban');

describe('anti-ban', () => {
  it('detects aggressive patterns', () => {
    const tmpFile = path.join(os.tmpdir(), 'blocked.json');
    const context = {
      blockedUsers: new Map(),
      floodCounters: new Map(),
      messageFingerprints: new Map(),
    };
    const antiBan = createAntiBan({
      antiBanEnabled: true,
      floodMaxMessages: 15,
      floodWindowSeconds: 60,
      floodCooldownSeconds: 120,
      spamSimilarityThreshold: 3,
      blockedUsersFile: tmpFile,
      disableTimers: true,
    }, context);

    assert.strictEqual(antiBan.isAggressivePattern('NO SIRVE ESTO!!!!!!'), true);
    assert.strictEqual(antiBan.isAggressivePattern('hola'), false);

    try { fs.unlinkSync(tmpFile); } catch (e) {}
  });

  it('detects spam', () => {
    const tmpFile = path.join(os.tmpdir(), 'blocked2.json');
    const context = {
      blockedUsers: new Map(),
      floodCounters: new Map(),
      messageFingerprints: new Map(),
    };
    const antiBan = createAntiBan({
      antiBanEnabled: true,
      floodMaxMessages: 15,
      floodWindowSeconds: 60,
      floodCooldownSeconds: 120,
      spamSimilarityThreshold: 2,
      blockedUsersFile: tmpFile,
      disableTimers: true,
    }, context);

    assert.strictEqual(antiBan.isSpam('user1', 'hola mundo'), false);
    assert.strictEqual(antiBan.isSpam('user1', 'hola mundo'), true);

    try { fs.unlinkSync(tmpFile); } catch (e) {}
  });
});
