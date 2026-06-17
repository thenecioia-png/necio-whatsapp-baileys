require('dotenv').config();
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

const config = {
  // Paths
  rootDir,
  sessionDir: process.env.SESSION_DIR || './auth_info_baileys',
  memoryFile: path.join(rootDir, 'memory', 'conversations.json'),
  blockedUsersFile: path.join(rootDir, 'memory', 'blocked_users.json'),
  knowledgeDir: path.join(rootDir, 'knowledge'),
  qrPath: path.join(rootDir, 'qr-code.png'),
  faqsPath: path.join(rootDir, 'config', 'faqs.json'),

  // Server
  port: parseInt(process.env.PORT || '3002', 10),
  host: process.env.HOST || '0.0.0.0',
  publicUrl: process.env.PUBLIC_URL || null,

  // API / Webhook
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL || '',
  apiSecret: process.env.API_SECRET || '',

  // Bot behavior
  rateLimitSeconds: parseInt(process.env.RATE_LIMIT_SECONDS || '10', 10),
  memoryMaxMessages: parseInt(process.env.MEMORY_MAX_MESSAGES || '3', 10),
  humanCommand: process.env.HUMAN_COMMAND || '/humano',
  adminWhatsApp: process.env.ADMIN_WHATSAPP || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  persistMemory: process.env.PERSIST_MEMORY === 'true',
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH || '600', 10),
  cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '3600000', 10),
  retrySendMax: parseInt(process.env.RETRY_SEND_MAX || '2', 10),
  aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '15000', 10),

  // Circuit breaker
  circuitFailureThreshold: parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '3', 10),
  circuitResetMs: parseInt(process.env.CIRCUIT_RESET_MS || '300000', 10),

  // Anti-ban
  antiBanEnabled: process.env.ANTI_BAN_ENABLED !== 'false',
  floodMaxMessages: parseInt(process.env.FLOOD_MAX_MESSAGES || '15', 10),
  floodWindowSeconds: parseInt(process.env.FLOOD_WINDOW_SECONDS || '60', 10),
  floodCooldownSeconds: parseInt(process.env.FLOOD_COOLDOWN_SECONDS || '120', 10),
  spamSimilarityThreshold: parseInt(process.env.SPAM_SIMILARITY_THRESHOLD || '3', 10),
  typingDelayMinMs: parseInt(process.env.TYPING_DELAY_MIN_MS || '400', 10),
  typingDelayMaxMs: parseInt(process.env.TYPING_DELAY_MAX_MS || '1500', 10),
  typingSpeedWpm: parseInt(process.env.TYPING_SPEED_WPM || '80', 10),
  sessionRotationEnabled: process.env.SESSION_ROTATION_ENABLED === 'true',

  // Cache
  cacheMaxAgeMs: 5 * 60 * 1000,
  cacheMaxEntries: 50,

  // Keep-alive
  keepAliveEnabled: process.env.KEEP_ALIVE_ENABLED !== 'false',
  keepAliveIntervalMs: parseInt(process.env.KEEP_ALIVE_INTERVAL_MS || '300000', 10),
  selfPingIntervalMs: 4 * 60 * 1000,
  externalPingTimeoutMs: 8 * 60 * 1000,
  whatsappReconnectOnPing: process.env.WHATSAPP_RECONNECT_ON_PING !== 'false',

  // Watchdog
  watchdogIntervalMs: parseInt(process.env.WATCHDOG_INTERVAL_MS || '600000', 10),

  // Reconnect
  maxReconnectAttempts: 20,
  baseReconnectDelay: 5000,

  // AI Keys
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-tiny',
  cerebrasApiKey: process.env.CEREBRAS_API_KEY || '',
  cerebrasModel: process.env.CEREBRAS_MODEL || 'llama-3.1-8b',
  togetherApiKey: process.env.TOGETHER_API_KEY || '',
  togetherModel: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.1-8B-Instruct-Turbo',
  cloudflareApiKey: process.env.CLOUDFLARE_API_KEY || '',
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  cloudflareModel: process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct',
  githubModelsToken: process.env.GITHUB_MODELS_TOKEN || '',
  githubModelsModel: process.env.GITHUB_MODELS_MODEL || 'meta-llama-3.1-8b-instruct',

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_KEY || '',
};

config.keepAliveUrl = process.env.KEEP_ALIVE_URL || `http://localhost:${config.port}/keep-alive`;

module.exports = config;
