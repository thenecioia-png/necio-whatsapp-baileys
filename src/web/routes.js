const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { parseDocument } = require('../utils/documents');

function createRoutes(config, context, deps) {
  const { apiSecret, knowledgeDir } = config;
  const { pages } = deps;

  function requireAuth(req, res, next) {
    if (!apiSecret) return next();
    const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized: falta API key' });
    const provided = authHeader.replace('Bearer ', '').trim();
    if (provided !== apiSecret) return res.status(403).json({ error: 'Forbidden: API key inválida' });
    next();
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, knowledgeDir),
      filename: (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ._-]/g, '_');
        cb(null, Date.now() + '_' + safe);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowed = /\.(md|txt|pdf|docx|doc|xlsx|xls|csv)$/i;
      if (file.mimetype === 'text/markdown' || file.mimetype === 'text/plain' ||
          file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
          file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.originalname.match(allowed)) {
        cb(null, true);
      } else {
        cb(new Error('Solo archivos .md, .txt, .pdf, .docx, .xlsx, .csv'), false);
      }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
  });

  function setup(app) {
    app.get('/', (req, res) => {
      res.json({
        status: context.isConnected ? 'connected' : 'disconnected',
        connected: context.isConnected,
        phone: context.botPhoneNumber,
        qrAvailable: !!context.qrCodeData,
        queueSize: context.messageQueue.length,
        activeConversations: context.conversations.size,
        humanModeUsers: context.humanMode.size,
        circuits: deps.getCircuitStatus(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    app.get('/health', (req, res) => {
      const mem = process.memoryUsage();
      const externalPingAgo = Date.now() - context.lastExternalPing;
      const selfPingAgo = Date.now() - context.lastSelfPing;
      res.status(200).json({
        status: 'healthy',
        server: 'up',
        whatsapp: context.isConnected ? 'connected' : 'disconnected',
        connected: context.isConnected,
        phone: context.botPhoneNumber || null,
        uptime: process.uptime(),
        queueSize: context.messageQueue.length,
        memoryMB: Math.round(mem.heapUsed / 1024 / 1024),
        keepAlive: {
          lastExternalPingAgoSec: Math.floor(externalPingAgo / 1000),
          lastSelfPingAgoSec: Math.floor(selfPingAgo / 1000),
          externalPingHealthy: externalPingAgo < config.externalPingTimeoutMs,
          selfPingHealthy: selfPingAgo < config.selfPingIntervalMs * 2
        },
        timestamp: new Date().toISOString()
      });
    });

    app.get('/keep-alive', async (req, res) => {
      context.lastExternalPing = Date.now();
      const pingSource = req.headers['user-agent'] || 'unknown';
      console.log(`[💓] Keep-alive ping recibido desde: ${pingSource.substring(0, 60)}`);

      let actionTaken = 'none';

      if (config.whatsappReconnectOnPing && !context.isConnected && !context.isShuttingDown) {
        const timeSinceLastReconnect = Date.now() - context.lastWhatsAppReconnectAttempt;
        if (timeSinceLastReconnect > 60000) {
          context.lastWhatsAppReconnectAttempt = Date.now();
          actionTaken = 'reconnect_attempt';
          console.log('[💓] WhatsApp desconectado detectado en keep-alive. Forzando reconexión...');
          try {
            if (context.sock) {
              context.sock.ev.removeAllListeners();
              context.sock = null;
            }
          } catch (e) {}
          setTimeout(() => {
            deps.startBot().catch(err => console.error('[!] Error en reconexión forzada:', err.message));
          }, 2000);
        } else {
          actionTaken = 'reconnect_skipped_rate_limit';
        }
      }

      res.status(200).json({
        status: 'ok',
        connected: context.isConnected,
        actionTaken,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    app.get('/status', (req, res) => {
      const healthy = context.isConnected && context.sock !== null;
      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'connected' : 'disconnected',
        connected: context.isConnected,
        uptime: process.uptime(),
        queueSize: context.messageQueue.length,
        timestamp: new Date().toISOString()
      });
    });

    app.post('/send', requireAuth, async (req, res) => {
      try {
        const { to, text } = req.body;
        if (!to || !text) return res.status(400).json({ error: 'Faltan campos: to, text' });
        if (!context.isConnected || !context.sock) return res.status(503).json({ error: 'WhatsApp no conectado' });
        await deps.sendWhatsAppMessage(to, text);
        res.json({ success: true, to, sent: true });
      } catch (err) {
        console.error('[!] Error en /send:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/qr', (req, res) => {
      if (!context.qrCodeData) {
        const accept = req.headers.accept || '';
        if (accept.includes('text/html')) {
          return res.send(pages.qrGeneratingPage());
        }
        return res.status(404).json({ error: 'QR no disponible' });
      }

      const QRCode = require('qrcode');
      QRCode.toDataURL(context.qrCodeData, { width: 400, margin: 2 })
        .then(url => {
          const accept = req.headers.accept || '';
          if (accept.includes('text/html')) {
            res.send(pages.qrPage(url));
          } else {
            res.json({ qr: url, raw: context.qrCodeData });
          }
        })
        .catch(err => res.status(500).json({ error: err.message }));
    });

    app.get('/qr-html', (req, res) => {
      if (!context.qrCodeData) {
        return res.send(pages.qrHtmlGeneratingPage());
      }
      const QRCode = require('qrcode');
      QRCode.toDataURL(context.qrCodeData, { width: 400, margin: 2 })
        .then(url => {
          res.send(pages.qrPage(url));
        })
        .catch(err => res.status(500).json({ error: err.message }));
    });

    app.post('/upload-knowledge', requireAuth, (req, res) => {
      try {
        const { filename, content } = req.body;
        if (!filename || !content) {
          return res.status(400).json({ error: 'Faltan campos: filename, content' });
        }
        const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
        const ext = safeName.endsWith('.md') || safeName.endsWith('.txt') ? '' : '.md';
        const filePath = path.join(knowledgeDir, safeName + ext);
        fs.writeFileSync(filePath, content, 'utf8');
        deps.reloadKnowledge();
        res.json({ success: true, file: safeName + ext, topics: context.knowledgeIndex.map(k => k.topic) });
      } catch (err) {
        console.error('[!] Error subiendo conocimiento:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/reload-knowledge', requireAuth, (req, res) => {
      const result = deps.reloadKnowledge();
      res.json({ success: true, ...result });
    });

    app.get('/knowledge', requireAuth, (req, res) => {
      res.json({
        topics: context.knowledgeIndex.map(k => ({ topic: k.topic, file: k.file, keywords: k.keywords.slice(0, 10), chunks: context.knowledgeChunks.filter(c => c.topic === k.topic).length })),
        total: context.knowledgeIndex.length,
        chunks: context.knowledgeChunks.length
      });
    });

    app.get('/stats', requireAuth, (req, res) => {
      deps.resetDailyStats();
      res.json({
        messagesTotal: context.analytics.messagesTotal,
        messagesToday: context.analytics.messagesToday,
        uniqueUsers: context.analytics.uniqueUsers.size,
        privateMessages: context.analytics.privateMessages,
        groupMessages: context.analytics.groupMessages,
        fallbackCount: context.analytics.fallbackCount,
        topicsUsed: [...context.analytics.topicsUsed.entries()].sort((a, b) => b[1] - a[1]),
        iaProviderUsage: [...context.analytics.iaProviderUsage.entries()].sort((a, b) => b[1] - a[1]),
        knowledge: {
          topics: context.knowledgeIndex.length,
          chunks: context.knowledgeChunks.length
        },
        circuits: deps.getCircuitStatus(),
        uptime: process.uptime()
      });
    });

    app.get('/learn', async (req, res) => {
      res.send(await pages.learnPage());
    });

    app.post('/upload-file', requireAuth, upload.single('knowledge'), async (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
        const originalName = req.file.originalname.replace(/\.[^.]+$/, '');
        const safeName = originalName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]/g, '_').toLowerCase();
        const ext = path.extname(req.file.originalname).toLowerCase();
        const finalName = safeName + '.md';
        const finalPath = path.join(knowledgeDir, finalName);

        if (['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv'].includes(ext)) {
          console.log(`[📄] Parseando ${ext} a markdown...`);
          const markdown = await parseDocument(req.file.path);
          fs.writeFileSync(finalPath, markdown, 'utf8');
          fs.unlinkSync(req.file.path);
        } else {
          fs.renameSync(req.file.path, finalPath);
        }

        deps.reloadKnowledge();
        res.json({ success: true, file: finalName, topics: context.knowledgeIndex.map(k => k.topic) });
      } catch (err) {
        console.error('[!] Error subiendo archivo:', err.message);
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/human-mode', requireAuth, (req, res) => {
      const { phone, active } = req.body;
      if (!phone) return res.status(400).json({ error: 'Falta phone' });
      const normalized = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
      if (active) {
        context.humanMode.add(normalized);
      } else {
        context.humanMode.delete(normalized);
      }
      res.json({ success: true, phone, humanMode: active });
    });

    app.get('/api/features', requireAuth, (req, res) => {
      try {
        res.json(deps.getAll());
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/features', requireAuth, (req, res) => {
      try {
        const updated = deps.updateFeatures(req.body);
        res.json({ success: true, features: updated });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/features/reload', requireAuth, (req, res) => {
      try {
        res.json({ success: true, features: deps.reloadFeatures() });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.post('/api/session/reconnect', requireAuth, async (req, res) => {
      try {
        if (context.sock) {
          try {
            context.sock.ev.removeAllListeners();
          } catch (e) {}
          context.sock = null;
        }
        context.reconnectAttempts = 0;
        setTimeout(() => deps.startBot().catch(() => {}), 2000);
        res.json({ success: true, message: 'Reconexión iniciada' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/admin', (req, res) => {
      res.send(pages.adminPage());
    });

    app.get('/admin/*path', (req, res) => {
      res.send(pages.adminPage());
    });
  }

  return { setup, requireAuth, upload };
}

module.exports = createRoutes;
