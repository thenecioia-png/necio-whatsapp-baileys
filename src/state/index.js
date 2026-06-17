const context = {
  // WhatsApp connection
  sock: null,
  isConnected: false,
  qrCodeData: null,
  reconnectAttempts: 0,
  isShuttingDown: false,
  botPhoneNumber: null,

  // Queues / processing
  messageQueue: [],
  isProcessing: false,

  // Rate limits
  rateLimits: new Map(),

  // Memory / conversations
  conversations: new Map(),

  // Modes
  humanMode: new Set(),
  learningMode: new Map(),

  // Analytics
  analytics: {
    messagesTotal: 0,
    messagesToday: 0,
    lastResetDate: new Date().toDateString(),
    topicsUsed: new Map(),
    fallbackCount: 0,
    iaProviderUsage: new Map(),
    uniqueUsers: new Set(),
    groupMessages: 0,
    privateMessages: 0,
  },

  // Circuit breakers
  circuitBreakers: new Map(),

  // Anti-ban
  floodCounters: new Map(),
  blockedUsers: new Map(),
  messageFingerprints: new Map(),
  typingInProgress: new Set(),

  // Keep-alive
  lastExternalPing: Date.now(),
  lastSelfPing: Date.now(),
  keepAliveInterval: null,
  lastWhatsAppReconnectAttempt: 0,

  // Session rotation
  sessionFailureLog: [],

  // DB
  supabase: null,
  dbEnabled: false,

  // Knowledge
  knowledgeBase: new Map(),
  knowledgeIndex: [],
  knowledgeChunks: [],
  idfCache: new Map(),

  // Cache
  responseCache: new Map(),

  // Preferences
  userPreferences: new Map(),

  // Throttle system messages
  systemMessageThrottle: new Map(),

  // Last connected time for watchdog
  lastConnectedTime: Date.now(),
};

module.exports = context;
