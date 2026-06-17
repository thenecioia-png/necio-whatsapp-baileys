const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

require('dotenv').config();

const config = require('./config');
const context = require('./state');
const { mkdirIfNeeded } = require('./utils/files');

const createDb = require('./db');
const createRag = require('./rag');
const brain = require('./brain');
const createAntiBan = require('./anti-ban');
const createCache = require('./cache');
const createAnalytics = require('./analytics');
const createCleanup = require('./cleanup');

const createGroq = require('./ai/providers/groq');
const createGemini = require('./ai/providers/gemini');
const createOpenRouter = require('./ai/providers/openrouter');
const createMistral = require('./ai/providers/mistral');
const createCerebras = require('./ai/providers/cerebras');
const createTogether = require('./ai/providers/together');
const createGitHubModels = require('./ai/providers/github');
const createPollinations = require('./ai/providers/pollinations');
const createCircuitBreaker = require('./ai/circuit-breaker');
const createDispatcher = require('./ai/dispatcher');
const createFallback = require('./ai/fallback');

const createN8n = require('./n8n');
const createSender = require('./whatsapp/sender');
const createProcessor = require('./processor');
const createQueue = require('./queue');
const createConnection = require('./whatsapp/connection');
const createKeepAlive = require('./keepalive');
const createPages = require('./web/pages');
const createRoutes = require('./web/routes');
const createWeb = require('./web');
const createFeatures = require('./features');
const createPersonality = require('./personality');

const deps = {};

// Crear directorios necesarios
mkdirIfNeeded(config.sessionDir);
mkdirIfNeeded(path.join(config.rootDir, 'config'));
mkdirIfNeeded(path.join(config.rootDir, 'memory'));
mkdirIfNeeded(config.knowledgeDir);

// Features configurable en caliente
const features = createFeatures(config, context, deps);
deps.features = features;
deps.isEnabled = features.isEnabled;
deps.getAI = features.getAI;
deps.getPersonality = features.getPersonality;
deps.getAll = features.getAll;
deps.updateFeatures = features.updateFeatures;
deps.reloadFeatures = features.reloadFeatures;

// Personalidad
const personality = createPersonality(config, context, deps);
deps.personality = personality;
deps.buildSystemPrompt = personality.buildSystemPrompt;
deps.reloadPersonality = personality.reloadPersonality;

// Base de datos
const db = createDb(config, context, deps);
deps.saveMessageToDb = db.saveMessageToDb;
deps.getContactHistory = db.getContactHistory;
deps.saveTransaction = db.saveTransaction;
deps.getBalance = db.getBalance;
deps.updateAnalyticsDaily = db.updateAnalyticsDaily;
deps.updateContactStatus = db.updateContactStatus;
deps.addContactTag = db.addContactTag;
deps.getContact = db.getContact;
deps.listContacts = db.listContacts;
deps.autoClassifyLead = db.autoClassifyLead;

// RAG
const rag = createRag(config, context, deps);
deps.loadKnowledge = rag.loadKnowledge;
deps.findRelevantKnowledge = rag.findRelevantKnowledge;
deps.reloadKnowledge = rag.reloadKnowledge;

// Anti-ban
const antiBan = createAntiBan(config, context, deps);
deps.isFlood = antiBan.isFlood;
deps.recordMessage = antiBan.recordMessage;
deps.isSpam = antiBan.isSpam;
deps.isAggressivePattern = antiBan.isAggressivePattern;

// Cache
const cache = createCache(config, context, deps);
deps.cache = cache;
deps.getCachedReply = cache.getCachedReply;
deps.setCachedReply = cache.setCachedReply;

// Analytics
const analytics = createAnalytics(config, context, deps);
deps.resetDailyStats = analytics.resetDailyStats;
deps.trackMessage = analytics.trackMessage;

// Cleanup
const cleanup = createCleanup(config, context, deps);

// AI providers
const providers = {
  askGroq: createGroq(config, context, deps),
  askGemini: createGemini(config, context, deps),
  askOpenRouter: createOpenRouter(config, context, deps),
  askMistral: createMistral(config, context, deps),
  askCerebras: createCerebras(config, context, deps),
  askTogether: createTogether(config, context, deps),
  askGitHubModels: createGitHubModels(config, context, deps),
  askPollinations: createPollinations(config, context, deps),
};

const circuitBreaker = createCircuitBreaker(config, context, deps);
deps.circuitBreaker = circuitBreaker;
deps.isCircuitOpen = circuitBreaker.isCircuitOpen;
deps.recordFailure = circuitBreaker.recordFailure;
deps.recordSuccess = circuitBreaker.recordSuccess;
deps.getCircuitStatus = circuitBreaker.getCircuitStatus;

const dispatcher = createDispatcher(config, context, {
  ...deps,
  ...providers,
});
deps.askAI = dispatcher.askAI;

const fallback = createFallback(config, context, deps);
deps.generateLocalReply = fallback.generateLocalReply;

// n8n
const n8n = createN8n(config, context, deps);
deps.sendToN8N = n8n.sendToN8N;

// WhatsApp sender
const sender = createSender(config, context, deps);
deps.sendWhatsAppMessage = sender.sendWhatsAppMessage;

// Processor
const processor = createProcessor(config, context, deps);
deps.processMessage = processor.processMessage;

// Queue
const queue = createQueue(config, context, deps);
deps.enqueueMessage = queue.enqueueMessage;
deps.processQueue = queue.processQueue;

// WhatsApp connection
const connection = createConnection(config, context, deps);
deps.startBot = connection.startBot;
deps.rotateSession = connection.rotateSession;

// Keep-alive
const keepAlive = createKeepAlive(config, context, deps);

// Web
const pages = createPages(config, context, deps);
const routes = createRoutes(config, context, { ...deps, pages });
const app = createWeb(config, context, { ...deps, routes, pages });

// Reset de sesión si se solicita
if (process.env.RESET_SESSION === 'true') {
  console.log('[🗑️] RESET_SESSION activado. Borrando sesión anterior...');
  if (fs.existsSync(config.sessionDir)) {
    try {
      const files = fs.readdirSync(config.sessionDir);
      for (const file of files) {
        try {
          fs.rmSync(path.join(config.sessionDir, file), { recursive: true, force: true });
        } catch (e) {}
      }
      console.log('[✅] Sesión anterior eliminada.');
    } catch (e) {
      console.error('[!] Error borrando sesión:', e.message);
    }
  }
}

// Inicializar DB, memoria y conocimiento
(async function init() {
  await db.initDatabase();
  db.loadConversations();
  rag.loadKnowledge();
})();

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Cerrando bot gracefulmente...`);
  context.isShuttingDown = true;
  await db.saveConversations();

  if (context.sock) {
    try {
      await context.sock.logout();
    } catch (e) {}
    context.sock = null;
  }

  console.log('[✅] Bot detenido. Hasta luego!');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Auto keep-alive ping
if (config.keepAliveEnabled) {
  const publicUrl = config.publicUrl || `http://localhost:${config.port}`;
  setInterval(() => {
    const url = `${publicUrl}/health`;
    http.get(url, (res) => {
      console.log(`[💓] Keep-alive ping OK: ${res.statusCode} | ${new Date().toISOString()}`);
    }).on('error', (err) => {
      console.log(`[💓] Keep-alive ping local (evita sleep): ${err.message}`);
    });
  }, config.keepAliveIntervalMs);
  console.log(`[💓] Auto keep-alive activado: cada ${config.keepAliveIntervalMs / 1000}s → ${publicUrl}/health`);
}

// Watchdog
setInterval(() => {
  if (context.isConnected) {
    context.lastConnectedTime = Date.now();
  } else {
    const disconnectedMinutes = Math.floor((Date.now() - context.lastConnectedTime) / 60000);
    console.log(`[🐕] Watchdog: desconectado hace ${disconnectedMinutes} min`);
    if (disconnectedMinutes >= 10 && !context.isShuttingDown) {
      console.log('[🐕] Watchdog: forzando reconexión...');
      context.reconnectAttempts = 0;
      connection.startBot().catch(e => console.error('[!] Watchdog reconnect failed:', e.message));
    }
  }
}, config.watchdogIntervalMs);

// Servidor HTTP
const server = app.listen(config.port, config.host, () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     🤖 THE NECIO - BOT WHATSAPP v3.1             ║');
  console.log('║     Multi-IA · Fallback Infinito · 24/7          ║');
  console.log('║     Auto-KeepAlive · Watchdog · Emociones        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  API HTTP:  http://${config.host}:${config.port}                 ║`);
  console.log(`║  IAs:       Cerebras → Groq → Gemini → OpenRouter ║`);
  console.log(`║  Fallback:  Respuesta local inteligente          ║`);
  console.log(`║  Memoria:   ${config.persistMemory ? 'PERSISTENTE' : 'VOLATIL'.padEnd(35)} ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Keep-Alive: Self-ping + cron-job.org compatible ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  keepAlive.startKeepAlive();
});

// Iniciar bot de WhatsApp
connection.startBot().catch((err) => {
  console.error('[!] Error fatal iniciando bot:', err);
  process.exit(1);
});

module.exports = { app, server, context, deps };
