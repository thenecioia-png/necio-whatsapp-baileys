const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');
const { getDisplayId, isValidUserJid } = require('../utils/helpers');

function createConnection(config, context, deps) {
  const {
    sessionDir,
    nodeEnv,
    maxReconnectAttempts,
    baseReconnectDelay,
    sessionRotationEnabled,
    adminWhatsApp,
    qrPath,
    host,
    port,
  } = config;

  function rotateSession() {
    if (!sessionRotationEnabled) return false;
    const now = Date.now();
    const tenMinAgo = now - 600000;
    context.sessionFailureLog = context.sessionFailureLog.filter(f => f.time > tenMinAgo);
    const recent401s = context.sessionFailureLog.filter(f => f.code === 401 || f.code === 403 || f.code === DisconnectReason.loggedOut).length;
    if (recent401s >= 2) {
      console.log('[🔄] Demasiados fallos 401. Rotando sesión...');
      try {
        if (fs.existsSync(sessionDir)) {
          const backupDir = `${sessionDir}_old_${Date.now()}`;
          fs.renameSync(sessionDir, backupDir);
          console.log(`[✅] Sesión rotada a ${backupDir}`);
          const parent = path.dirname(sessionDir);
          const baseName = path.basename(sessionDir);
          const backups = fs.readdirSync(parent)
            .filter(d => d.startsWith(baseName + '_old_'))
            .map(d => ({ name: d, path: path.join(parent, d), stat: fs.statSync(path.join(parent, d)) }))
            .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
          for (const b of backups.slice(3)) {
            try { fs.rmSync(b.path, { recursive: true, force: true }); } catch (e) {}
          }
        }
      } catch (e) {
        console.error('[!] Error rotando sesión:', e.message);
      }
      context.sessionFailureLog = [];
      return true;
    }
    return false;
  }

  async function startBot() {
    if (context.isShuttingDown) return;

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    context.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      keepAliveIntervalMs: 30000,
      browser: Browsers.appropriate('Chrome'),
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      shouldIgnoreJid: (jid) => {
        if (jid === 'status@broadcast') return true;
        if (jid.endsWith('@g.us')) return true;
        return false;
      }
    });

    context.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        context.qrCodeData = qr;
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║  ESCANEA ESTE QR CON TU WHATSAPP              ║');
        console.log('║  Ajustes > Dispositivos vinculados > Vincular ║');
        console.log('╚════════════════════════════════════════════════╝\n');
        qrcode.generate(qr, { small: false });

        QRCode.toFile(qrPath, qr, { width: 600, margin: 4 }, (err) => {
          if (!err) {
            console.log('[+] QR guardado como qr-code.png');
          }
        });
      }

      if (connection === 'close') {
        context.isConnected = false;
        context.qrCodeData = null;
        context.reconnectAttempts++;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log(`\n[!] Conexión cerrada. Código: ${statusCode}. Intento ${context.reconnectAttempts}/${maxReconnectAttempts}`);

        if (statusCode === 401 || statusCode === 403 || statusCode === DisconnectReason.loggedOut) {
          context.sessionFailureLog.push({ code: statusCode || 0, time: Date.now() });
        }

        if (context.reconnectAttempts >= maxReconnectAttempts) {
          console.log('[!] Máximos intentos de reconexión alcanzados. Rotando sesión...');
          rotateSession();
          context.reconnectAttempts = 0;
        }

        if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
          console.log('[!] Sesión inválida o cerrada. Borrando credenciales...');
          try {
            if (fs.existsSync(sessionDir)) {
              const entries = fs.readdirSync(sessionDir);
              for (const entry of entries) {
                const fullPath = path.join(sessionDir, entry);
                try {
                  fs.rmSync(fullPath, { recursive: true, force: true });
                } catch (e) {
                  console.error(`[!] No se pudo borrar ${entry}:`, e.message);
                }
              }
              console.log('[✅] Sesión borrada. Se generará QR nuevo.');
            }
          } catch (e) {
            console.error('[!] Error borrando sesión:', e.message);
          }
          rotateSession();
          context.reconnectAttempts = 0;
          if (adminWhatsApp) {
            deps.sendWhatsAppMessage(adminWhatsApp, '⚠️ Sesión borrada. Escanea QR nuevo en: https://necio-whatsapp-bot-v3.fly.dev/qr', { simulateTyping: false })
              .catch(() => {});
          }
          if (!context.isShuttingDown) {
            const delay = nodeEnv === 'production' ? 15000 + Math.floor(Math.random() * 10000) : 5000;
            console.log(`[+] Reiniciando en ${delay / 1000}s para generar QR...\n`);
            setTimeout(startBot, delay);
          }
        } else if (!context.isShuttingDown) {
          const delay = Math.min(baseReconnectDelay * Math.pow(2, context.reconnectAttempts - 1), 300000);
          const jitter = Math.floor(Math.random() * 5000);
          const totalDelay = delay + jitter;
          console.log(`[+] Reconectando en ${(totalDelay / 1000).toFixed(1)}s... (backoff exponencial)\n`);
          setTimeout(startBot, totalDelay);
        }
      }

      if (connection === 'open') {
        context.isConnected = true;
        context.qrCodeData = null;
        context.reconnectAttempts = 0;
        context.lastWhatsAppReconnectAttempt = 0;
        context.lastConnectedTime = Date.now();
        context.botPhoneNumber = context.sock.user?.id?.split(':')[0];
        console.log('\n✅ BOT CONECTADO Y LISTO');
        console.log('📱 Número:', context.botPhoneNumber);
        console.log('🌐 API HTTP: http://' + host + ':' + port);
        console.log('⏳ Esperando mensajes...\n');
      }
    });

    context.sock.ev.on('creds.update', saveCreds);

    context.sock.ev.on('messages.upsert', async (m) => {
      const msg = m.messages[0];
      if (!msg.key.fromMe && msg.message) {
        const sender = msg.key.remoteJid;

        if (sender.endsWith('@g.us')) {
          console.log(`[👥] Grupo ignorado: ${sender}`);
          return;
        }
        if (sender === 'status@broadcast') {
          console.log(`[📢] Estado de WhatsApp ignorado`);
          return;
        }
        if (!isValidUserJid(sender)) {
          console.log(`[⚠️] JID no válido ignorado: ${sender}`);
          return;
        }

        let text = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || msg.message.buttonsResponseMessage?.selectedButtonId
          || msg.message.listResponseMessage?.singleSelectReply?.selectedRowId
          || msg.message.templateButtonReplyMessage?.selectedId
          || '';
        text = text.trim();
        if (!text) {
          console.log(`[📭] Mensaje vacío ignorado de ${getDisplayId(sender)}`);
          return;
        }

        const pushName = msg.pushName || 'Cliente';
        const timestamp = msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now();

        console.log(`[📩] ${pushName} (${getDisplayId(sender)}): ${text.substring(0, 80)}`);

        deps.sendToN8N({
          from: getDisplayId(sender),
          name: pushName,
          body: text,
          timestamp,
          chatId: sender,
          messageId: msg.key.id
        });

        deps.enqueueMessage(sender, pushName, text);
      }
    });
  }

  return { startBot, rotateSession };
}

module.exports = createConnection;
