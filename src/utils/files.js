const fs = require('fs');
const path = require('path');

function mkdirIfNeeded(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function safeWriteJSON(filePath, data) {
  try {
    mkdirIfNeeded(path.dirname(filePath));
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[!] Error escribiendo JSON:', e.message);
    return false;
  }
}

function safeReadJSON(filePath, defaultValue = {}) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error('[!] Error leyendo JSON:', e.message);
    return defaultValue;
  }
}

module.exports = {
  mkdirIfNeeded,
  safeWriteJSON,
  safeReadJSON,
};
