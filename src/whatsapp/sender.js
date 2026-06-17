function createSender(config, context) {
  const {
    antiBanEnabled,
    typingDelayMinMs,
    typingDelayMaxMs,
    typingSpeedWpm,
    retrySendMax,
  } = config;

  async function sendWhatsAppMessage(to, text, options = {}) {
    if (!context.sock) throw new Error('WhatsApp no conectado');
    const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    const content = String(text);

    if (antiBanEnabled && options.simulateTyping !== false && context.sock) {
      const wordCount = content.split(/\s+/).length;
      const typingDurationMs = Math.max(
        typingDelayMinMs,
        Math.min(
          typingDelayMaxMs,
          (wordCount / typingSpeedWpm) * 60 * 1000 * (0.8 + Math.random() * 0.4)
        )
      );
      const showTyping = Math.random() > 0.2;
      if (showTyping) {
        const chunks = Math.max(1, Math.floor(typingDurationMs / 3000));
        context.typingInProgress.add(jid);
        try {
          for (let i = 0; i < chunks; i++) {
            if (!context.typingInProgress.has(jid)) break;
            await context.sock.sendPresenceUpdate('composing', jid);
            await new Promise(r => setTimeout(r, Math.min(3000, typingDurationMs / chunks)));
          }
          if (Math.random() > 0.5) {
            await context.sock.sendPresenceUpdate('paused', jid);
            await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
          }
        } catch (e) {
          // ignorar errores de typing
        }
        context.typingInProgress.delete(jid);
      }
      await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
    }

    let lastError = null;
    for (let attempt = 1; attempt <= retrySendMax; attempt++) {
      try {
        await context.sock.sendMessage(jid, { text: content });
        return;
      } catch (err) {
        lastError = err;
        console.error(`[!] Error enviando mensaje (intento ${attempt}/${retrySendMax}):`, err.message);
        if (attempt < retrySendMax) {
          const jitter = 1000 * attempt + Math.floor(Math.random() * 1000);
          await new Promise(r => setTimeout(r, jitter));
        }
      }
    }
    throw lastError || new Error('No se pudo enviar el mensaje');
  }

  return { sendWhatsAppMessage };
}

module.exports = createSender;
