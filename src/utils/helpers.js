function pickVariation(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeForFingerprint(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDisplayId(jid) {
  if (!jid) return 'desconocido';
  return String(jid).split('@')[0];
}

function isValidUserJid(jid) {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength) + '... [mensaje truncado]';
}

function getCacheKey(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

module.exports = {
  pickVariation,
  normalizeForFingerprint,
  getDisplayId,
  isValidUserJid,
  truncateText,
  getCacheKey,
};
