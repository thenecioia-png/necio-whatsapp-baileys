const { describe, it } = require('node:test');
const assert = require('node:assert');
const brain = require('../src/brain');

describe('brain', () => {
  it('detects greeting', () => {
    assert.strictEqual(brain.isGreeting('hola'), true);
    assert.strictEqual(brain.isGreeting('Hola, ¿cómo estás?'), true);
    assert.strictEqual(brain.isGreeting('quiero información'), false);
  });

  it('detects farewell', () => {
    assert.strictEqual(brain.isFarewell('adiós'), true);
    assert.strictEqual(brain.isFarewell('gracias'), false);
  });

  it('detects thanks', () => {
    assert.strictEqual(brain.isThanks('gracias'), true);
    assert.strictEqual(brain.isThanks('hola'), false);
  });

  it('detects emotion', () => {
    const emotions = brain.detectEmotion('estoy harto');
    assert.ok(emotions.includes('frustrated'));
  });

  it('needsClarification for short text', () => {
    assert.strictEqual(brain.needsClarification('ok'), true);
  });

  it('rememberPreference stores value', () => {
    const context = { userPreferences: new Map() };
    brain.rememberPreference(context, 'user1', 'name', 'Juan');
    assert.strictEqual(brain.getPreference(context, 'user1', 'name'), 'Juan');
  });
});
