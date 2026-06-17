const { describe, it } = require('node:test');
const assert = require('node:assert');
const helpers = require('../src/utils/helpers');

describe('utils/helpers', () => {
  it('pickVariation returns an array element', () => {
    const arr = ['a', 'b', 'c'];
    const result = helpers.pickVariation(arr);
    assert.ok(arr.includes(result));
  });

  it('getDisplayId extracts phone from jid', () => {
    assert.strictEqual(helpers.getDisplayId('18091234567@s.whatsapp.net'), '18091234567');
    assert.strictEqual(helpers.getDisplayId(null), 'desconocido');
  });

  it('isValidUserJid validates WhatsApp jids', () => {
    assert.strictEqual(helpers.isValidUserJid('18091234567@s.whatsapp.net'), true);
    assert.strictEqual(helpers.isValidUserJid('18091234567@lid'), true);
    assert.strictEqual(helpers.isValidUserJid('group@g.us'), false);
    assert.strictEqual(helpers.isValidUserJid(null), false);
  });

  it('truncateText truncates long text', () => {
    const short = 'hola';
    assert.strictEqual(helpers.truncateText(short, 10), short);
    const long = 'a'.repeat(100);
    assert.ok(helpers.truncateText(long, 10).endsWith('... [mensaje truncado]'));
  });

  it('normalizeForFingerprint removes special chars', () => {
    assert.strictEqual(helpers.normalizeForFingerprint('¡Hola, Mundo!'), 'hola mundo');
  });

  it('getCacheKey normalizes text', () => {
    assert.strictEqual(helpers.getCacheKey('  ¡Hola!!  '), 'hola');
  });
});
