const { normalizeForFingerprint, getDisplayId } = require('../utils/helpers');
const { safeReadJSON, safeWriteJSON } = require('../utils/files');

function createAntiBan(config, context) {
  const {
    antiBanEnabled,
    floodMaxMessages,
    floodWindowSeconds,
    floodCooldownSeconds,
    spamSimilarityThreshold,
    blockedUsersFile,
  } = config;

  function loadBlockedUsers() {
    if (!antiBanEnabled) return;
    try {
      const data = safeReadJSON(blockedUsersFile, {});
      const now = Date.now();
      for (const [uid, ts] of Object.entries(data)) {
        if (ts > now) context.blockedUsers.set(uid, ts);
      }
      console.log(`[🛡️] Lista de bloqueados cargada: ${context.blockedUsers.size} usuarios`);
    } catch (e) {
      console.error('[!] Error cargando bloqueados:', e.message);
    }
  }

  function saveBlockedUsers() {
    if (!antiBanEnabled) return;
    try {
      const data = Object.fromEntries(context.blockedUsers);
      safeWriteJSON(blockedUsersFile, data);
    } catch (e) {
      console.error('[!] Error guardando bloqueados:', e.message);
    }
  }

  function isFlood(userId) {
    if (!antiBanEnabled) return false;
    const now = Date.now();
    const unblock = context.blockedUsers.get(userId);
    if (unblock && now < unblock) {
      return true;
    }
    if (unblock && now >= unblock) {
      context.blockedUsers.delete(userId);
    }
    const windowMs = floodWindowSeconds * 1000;
    const entries = context.floodCounters.get(userId) || [];
    const recent = entries.filter(ts => now - ts < windowMs);
    context.floodCounters.set(userId, recent);
    if (recent.length >= floodMaxMessages) {
      const cooldownMs = floodCooldownSeconds * 1000;
      context.blockedUsers.set(userId, now + cooldownMs);
      console.log(`[🚫] Flood detectado de ${getDisplayId(userId)}. Bloqueado ${floodCooldownSeconds}s.`);
      return true;
    }
    return false;
  }

  function recordMessage(userId) {
    if (!antiBanEnabled) return;
    const entries = context.floodCounters.get(userId) || [];
    entries.push(Date.now());
    context.floodCounters.set(userId, entries);
  }

  function isSpam(userId, text) {
    if (!antiBanEnabled) return false;
    const normalized = normalizeForFingerprint(text);
    if (normalized.length < 5) return false;
    const now = Date.now();
    const fingerprints = context.messageFingerprints.get(userId) || [];
    const idx = fingerprints.findIndex(f => f.hash === normalized);
    if (idx !== -1) {
      fingerprints[idx].count++;
      fingerprints[idx].lastSeen = now;
      if (fingerprints[idx].count >= spamSimilarityThreshold) {
        console.log(`[🚫] Spam detectado de ${getDisplayId(userId)}: "${normalized.substring(0, 30)}..."`);
        return true;
      }
    } else {
      fingerprints.push({ hash: normalized, count: 1, lastSeen: now });
      if (fingerprints.length > 20) fingerprints.shift();
    }
    context.messageFingerprints.set(userId, fingerprints);
    return false;
  }

  function isAggressivePattern(text) {
    if (!antiBanEnabled) return false;
    const alpha = text.replace(/[^a-zA-Z]/g, '');
    const capsRatio = (alpha.match(/[A-Z]/g) || []).length / Math.max(alpha.length, 1);
    const exclamationCount = (text.match(/!/g) || []).length;
    const repeatedChars = /(.)\1{5,}/.test(text);
    return (capsRatio > 0.7 && text.length > 10) || exclamationCount > 5 || repeatedChars;
  }

  if (antiBanEnabled) {
    loadBlockedUsers();
    if (!config.disableTimers) {
      setInterval(saveBlockedUsers, 60000);
    }
  }

  return {
    isFlood,
    recordMessage,
    isSpam,
    isAggressivePattern,
    loadBlockedUsers,
    saveBlockedUsers,
  };
}

module.exports = createAntiBan;
