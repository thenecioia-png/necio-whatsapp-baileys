const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const createRag = require('../src/rag');

describe('rag', () => {
  it('loads knowledge from directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-test-'));
    fs.writeFileSync(path.join(tmpDir, 'test.md'), 'Este es un documento de prueba sobre soldadura y construcción.');

    const context = {
      knowledgeBase: new Map(),
      knowledgeIndex: [],
      knowledgeChunks: [],
      idfCache: new Map(),
    };
    const rag = createRag({ knowledgeDir: tmpDir }, context);
    rag.loadKnowledge();

    assert.ok(context.knowledgeIndex.length > 0);
    assert.ok(context.knowledgeChunks.length > 0);

    const relevant = rag.findRelevantKnowledge('soldadura', 2500);
    assert.ok(relevant);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
