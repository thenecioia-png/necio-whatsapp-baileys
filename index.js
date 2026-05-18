const express = require('express');
const bodyParser = require('body-parser');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const multer = require('multer');

// Librerías para parsear documentos (PDF, DOCX, XLSX)
let pdfParse, mammoth, xlsx;
try { pdfParse = require('pdf-parse'); } catch (e) { pdfParse = null; }
try { mammoth = require('mammoth'); } catch (e) { mammoth = null; }
try { xlsx = require('xlsx'); } catch (e) { xlsx = null; }

// ═══════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════
require('dotenv').config();

const SESSION_DIR = process.env.SESSION_DIR || './auth_info_baileys';
const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const API_SECRET = process.env.API_SECRET || '';
const RATE_LIMIT_SECONDS = parseInt(process.env.RATE_LIMIT_SECONDS || '10');
const MEMORY_MAX_MESSAGES = parseInt(process.env.MEMORY_MAX_MESSAGES || '3');
const HUMAN_COMMAND = process.env.HUMAN_COMMAND || '/humano';
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || '';
const NODE_ENV = process.env.NODE_ENV || 'development';
const PERSIST_MEMORY = process.env.PERSIST_MEMORY === 'true';
const MEMORY_FILE = path.join(__dirname, 'memory', 'conversations.json');
const MAX_MESSAGE_LENGTH = parseInt(process.env.MAX_MESSAGE_LENGTH || '600');
const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || '3600000');
const RETRY_SEND_MAX = parseInt(process.env.RETRY_SEND_MAX || '2');
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '15000');
const CIRCUIT_FAILURE_THRESHOLD = parseInt(process.env.CIRCUIT_FAILURE_THRESHOLD || '3');
const CIRCUIT_RESET_MS = parseInt(process.env.CIRCUIT_RESET_MS || '300000'); // 5 min

// ─── ANTI-BAN CONFIG ────────────────────────────────────────────
const ANTI_BAN_ENABLED = process.env.ANTI_BAN_ENABLED !== 'false'; // default true

// ─── NUEVAS APIs GRATUITAS (ilimitado) ───────────────────────────
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || '';
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'llama-3.1-8b';
const TOGETHER_API_KEY = process.env.TOGETHER_API_KEY || '';
const TOGETHER_MODEL = process.env.TOGETHER_MODEL || 'meta-llama/Llama-3.1-8B-Instruct-Turbo';
const CLOUDFLARE_API_KEY = process.env.CLOUDFLARE_API_KEY || '';
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CLOUDFLARE_MODEL = process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct';
const GITHUB_MODELS_TOKEN = process.env.GITHUB_MODELS_TOKEN || '';
const GITHUB_MODELS_MODEL = process.env.GITHUB_MODELS_MODEL || 'meta-llama-3.1-8b-instruct';

// Cache de respuestas: { normalizedQuestion: { reply, timestamp } }
const responseCache = new Map();
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos
const CACHE_MAX_ENTRIES = 50;

function getCacheKey(text) {
  // Normalizar para cache: minúsculas, solo palabras clave
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().substring(0, 80);
}

function getCachedReply(text) {
  const key = getCacheKey(text);
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_MAX_AGE_MS) {
    responseCache.delete(key);
    return null;
  }
  console.log(`[💾] Cache hit: "${key.substring(0, 40)}..."`);
  return entry.reply;
}

function setCachedReply(text, reply) {
  const key = getCacheKey(text);
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
  responseCache.set(key, { reply, timestamp: Date.now() });
}
const FLOOD_MAX_MESSAGES = parseInt(process.env.FLOOD_MAX_MESSAGES || '15');
const FLOOD_WINDOW_SECONDS = parseInt(process.env.FLOOD_WINDOW_SECONDS || '60');
const FLOOD_COOLDOWN_SECONDS = parseInt(process.env.FLOOD_COOLDOWN_SECONDS || '120'); // 2 min
const SPAM_SIMILARITY_THRESHOLD = parseInt(process.env.SPAM_SIMILARITY_THRESHOLD || '3');
const TYPING_DELAY_MIN_MS = parseInt(process.env.TYPING_DELAY_MIN_MS || '400');
const TYPING_DELAY_MAX_MS = parseInt(process.env.TYPING_DELAY_MAX_MS || '1500');
const TYPING_SPEED_WPM = parseInt(process.env.TYPING_SPEED_WPM || '80');
const SESSION_ROTATION_ENABLED = process.env.SESSION_ROTATION_ENABLED === 'true';
const BLOCKED_USERS_FILE = path.join(__dirname, 'memory', 'blocked_users.json');

// ─── KEYS DE IA ─────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free';
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || '';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-tiny';

// Cargar FAQs
let FAQS_DATA = { faqs: [], system_prompt: '' };
try {
  const faqsPath = path.join(__dirname, 'config', 'faqs.json');
  if (fs.existsSync(faqsPath)) {
    FAQS_DATA = JSON.parse(fs.readFileSync(faqsPath, 'utf8'));
    console.log('[✅] FAQs cargadas:', FAQS_DATA.faqs.length, 'preguntas');
  }
} catch (e) {
  console.error('[!] Error cargando FAQs:', e.message);
}

let FAQS_TEXT = FAQS_DATA.faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n');
// Truncar FAQs para no saturar tokens de las APIs (máx ~2000 chars)
if (FAQS_TEXT.length > 2000) {
  FAQS_TEXT = FAQS_TEXT.substring(0, 2000) + '\n... (más FAQs disponibles)';
}
const SYSTEM_PROMPT = FAQS_DATA.system_prompt || 'Eres el asistente virtual oficial de The Necio Digital. Tienes acceso a conocimientos especializados en ventas, construcción, soldadura, herrería, leyes y más. Usa el conocimiento especializado cuando sea relevante para la pregunta del usuario. Si no sabes algo, lo admites honestamente. Eres profesional pero cercano, con tono dominicano natural.';

// ═══════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════════
let sock = null;
let isConnected = false;
let qrCodeData = null;
let isShuttingDown = false;
let botPhoneNumber = null;

// Cola de mensajes
const messageQueue = [];
let isProcessing = false;

// Rate limiting: { userId: lastTimestamp }
const rateLimits = new Map();

// Memoria de conversaciones: { userId: [{role, content}] }
let conversations = new Map();

// Usuarios en modo humano: Set<userId>
const humanMode = new Set();

// Usuarios en modo aprendizaje: Map<userId, { topic, step }>
const learningMode = new Map();

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS (Estadísticas de uso)
// ═══════════════════════════════════════════════════════════════════
const analytics = {
  messagesTotal: 0,
  messagesToday: 0,
  lastResetDate: new Date().toDateString(),
  topicsUsed: new Map(), // { topic: count }
  fallbackCount: 0,
  iaProviderUsage: new Map(), // { provider: count }
  uniqueUsers: new Set(),
  groupMessages: 0,
  privateMessages: 0
};

function resetDailyStats() {
  const today = new Date().toDateString();
  if (analytics.lastResetDate !== today) {
    analytics.messagesToday = 0;
    analytics.lastResetDate = today;
    console.log(`[📊] Stats diarias reiniciadas: ${today}`);
  }
}

function trackMessage(type = 'private', provider = null, usedFallback = false, topic = null) {
  resetDailyStats();
  analytics.messagesTotal++;
  analytics.messagesToday++;
  if (type === 'group') analytics.groupMessages++;
  else analytics.privateMessages++;
  if (provider) analytics.iaProviderUsage.set(provider, (analytics.iaProviderUsage.get(provider) || 0) + 1);
  if (usedFallback) analytics.fallbackCount++;
  if (topic) analytics.topicsUsed.set(topic, (analytics.topicsUsed.get(topic) || 0) + 1);
}

setInterval(resetDailyStats, 3600000); // Revisar cada hora

// Circuit breakers para IAs: { provider: { failures, lastFailure, open } }
const circuitBreakers = new Map();

// Anti-ban state
const floodCounters = new Map(); // { userId: [{ timestamp }] }
const blockedUsers = new Map();  // { userId: unblockTimestamp }
const messageFingerprints = new Map(); // { userId: [{ hash, count, lastSeen }] }
const typingInProgress = new Set();

// Variaciones naturales de respuestas comunes (evita patrones robóticos)
const GREETING_VARIATIONS = [
  '¡Hola! 👋 ¿En qué puedo ayudarte hoy?',
  'Hola, bienvenido. ¿Cómo puedo asistirte?',
  '¡Buen día! Cuéntame, ¿qué necesitas?',
  'Hola 👋 ¿Qué tal? Estoy aquí para ayudarte.',
  '¡Saludos! ¿En qué te puedo colaborar?',
];
const THANKS_VARIATIONS = [
  '¡Con gusto! 😊 Si necesitas algo más, aquí estoy.',
  'De nada. ¡Que tengas un excelente día!',
  'Para servirte. ¿Algo más en lo que pueda ayudarte?',
  'No hay de qué. Cuando quieras me escribes.',
];
const BUSY_VARIATIONS = [
  'Dame un momento, estoy procesando tu solicitud...',
  'Un segundo, déjame revisar eso...',
  'Estoy en ello, ya te respondo...',
  'Procesando... 🧠',
];
const FALLBACK_VARIATIONS = [
  'Lo siento, estoy teniendo dificultades técnicas. ¿Puedes reformular tu pregunta?',
  'Disculpa, no pude conectarme con mis servicios en este momento. Intenta de nuevo en unos segundos.',
  'Vaya, parece que hay un problema temporal. ¿Podemos intentarlo de nuevo?',
  'Estoy experimentando lentitud en mis servicios. Por favor, repite tu mensaje.',
];

function pickVariation(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeForFingerprint(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFlood(userId) {
  if (!ANTI_BAN_ENABLED) return false;
  const now = Date.now();
  const unblock = blockedUsers.get(userId);
  if (unblock && now < unblock) {
    return true;
  }
  if (unblock && now >= unblock) {
    blockedUsers.delete(userId);
  }
  const windowMs = FLOOD_WINDOW_SECONDS * 1000;
  const entries = floodCounters.get(userId) || [];
  const recent = entries.filter(ts => now - ts < windowMs);
  floodCounters.set(userId, recent);
  if (recent.length >= FLOOD_MAX_MESSAGES) {
    const cooldownMs = FLOOD_COOLDOWN_SECONDS * 1000;
    blockedUsers.set(userId, now + cooldownMs);
    console.log(`[🚫] Flood detectado de ${getDisplayId(userId)}. Bloqueado ${FLOOD_COOLDOWN_SECONDS}s.`);
    return true;
  }
  return false;
}

function recordMessage(userId) {
  if (!ANTI_BAN_ENABLED) return;
  const entries = floodCounters.get(userId) || [];
  entries.push(Date.now());
  floodCounters.set(userId, entries);
}

function isSpam(userId, text) {
  if (!ANTI_BAN_ENABLED) return false;
  const normalized = normalizeForFingerprint(text);
  if (normalized.length < 5) return false;
  const now = Date.now();
  const fingerprints = messageFingerprints.get(userId) || [];
  const idx = fingerprints.findIndex(f => f.hash === normalized);
  if (idx !== -1) {
    fingerprints[idx].count++;
    fingerprints[idx].lastSeen = now;
    if (fingerprints[idx].count >= SPAM_SIMILARITY_THRESHOLD) {
      console.log(`[🚫] Spam detectado de ${getDisplayId(userId)}: "${normalized.substring(0, 30)}..."`);
      return true;
    }
  } else {
    fingerprints.push({ hash: normalized, count: 1, lastSeen: now });
    if (fingerprints.length > 20) fingerprints.shift();
  }
  messageFingerprints.set(userId, fingerprints);
  return false;
}

function isAggressivePattern(text) {
  if (!ANTI_BAN_ENABLED) return false;
  const capsRatio = (text.replace(/[^a-zA-Z]/g, '').match(/[A-Z]/g) || []).length / Math.max(text.replace(/[^a-zA-Z]/g, '').length, 1);
  const exclamationCount = (text.match(/!/g) || []).length;
  const repeatedChars = /(.)\1{5,}/.test(text);
  return (capsRatio > 0.7 && text.length > 10) || exclamationCount > 5 || repeatedChars;
}

function loadBlockedUsers() {
  try {
    if (fs.existsSync(BLOCKED_USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BLOCKED_USERS_FILE, 'utf8'));
      const now = Date.now();
      for (const [uid, ts] of Object.entries(data)) {
        if (ts > now) blockedUsers.set(uid, ts);
      }
      console.log(`[🛡️] Lista de bloqueados cargada: ${blockedUsers.size} usuarios`);
    }
  } catch (e) {
    console.error('[!] Error cargando bloqueados:', e.message);
  }
}

function saveBlockedUsers() {
  try {
    const dir = path.dirname(BLOCKED_USERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = Object.fromEntries(blockedUsers);
    fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[!] Error guardando bloqueados:', e.message);
  }
}

if (ANTI_BAN_ENABLED) {
  loadBlockedUsers();
  setInterval(saveBlockedUsers, 60000);
}

const app = express();
app.use(bodyParser.json());

// ─── MIDDLEWARE: API Secret para endpoints sensibles ────────────
function requireAuth(req, res, next) {
  if (!API_SECRET) return next(); // Si no hay secret configurado, dejar pasar
  const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized: falta API key' });
  const provided = authHeader.replace('Bearer ', '').trim();
  if (provided !== API_SECRET) return res.status(403).json({ error: 'Forbidden: API key inválida' });
  next();
}

// ═══════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════════

function isCircuitOpen(provider) {
  const cb = circuitBreakers.get(provider);
  if (!cb) return false;
  if (cb.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    if (Date.now() - cb.lastFailure < CIRCUIT_RESET_MS) {
      return true;
    }
    // Reset después del cooldown
    cb.failures = 0;
    cb.open = false;
  }
  return false;
}

function recordFailure(provider) {
  const cb = circuitBreakers.get(provider) || { failures: 0, lastFailure: 0, open: false };
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= CIRCUIT_FAILURE_THRESHOLD) {
    cb.open = true;
    console.log(`[⚡] Circuito ABIERTO para ${provider} (${CIRCUIT_RESET_MS / 1000}s)`);
  }
  circuitBreakers.set(provider, cb);
}

function recordSuccess(provider) {
  circuitBreakers.set(provider, { failures: 0, lastFailure: 0, open: false });
}

function getCircuitStatus() {
  const status = {};
  for (const [name, cb] of circuitBreakers.entries()) {
    status[name] = { open: cb.open || isCircuitOpen(name), failures: cb.failures };
  }
  return status;
}

// ═══════════════════════════════════════════════════════════════════
// PERSISTENCIA DE MEMORIA
// ═══════════════════════════════════════════════════════════════════

function loadConversations() {
  if (!PERSIST_MEMORY) return;
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
      conversations = new Map(Object.entries(data));
      console.log(`[💾] Memoria cargada: ${conversations.size} conversaciones`);
    }
  } catch (e) {
    console.error('[!] Error cargando memoria:', e.message);
  }
}

async function saveConversations() {
  if (!PERSIST_MEMORY) return;
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = Object.fromEntries(conversations);
    await fs.promises.writeFile(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[!] Error guardando memoria:', e.message);
  }
}

if (PERSIST_MEMORY) {
  setInterval(() => saveConversations().catch(() => {}), 30000);
}

// ═══════════════════════════════════════════════════════════════════
// PARSEO DE DOCUMENTOS (PDF, DOCX, XLSX → Markdown)
// ═══════════════════════════════════════════════════════════════════

async function parseDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath, ext);
  
  try {
    if (ext === '.pdf' && pdfParse) {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return `# ${filename.toUpperCase()}\n\n${data.text || '[PDF sin texto extraíble]'}`;
    }
    
    if ((ext === '.docx' || ext === '.doc') && mammoth) {
      const result = await mammoth.extractRawText({ path: filePath });
      return `# ${filename.toUpperCase()}\n\n${result.value || '[DOCX sin texto]'}`;
    }
    
    if ((ext === '.xlsx' || ext === '.xls' || ext === '.csv') && xlsx) {
      const workbook = xlsx.readFile(filePath);
      let md = `# ${filename.toUpperCase()}\n\n`;
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        md += `## Hoja: ${sheetName}\n\n`;
        // Convertir a tabla markdown
        for (const row of json) {
          if (row.length === 0) continue;
          md += row.map(c => String(c || '').replace(/\|/g, '\\|')).join(' | ') + '\n';
        }
        md += '\n';
      }
      return md;
    }
    
    // Fallback: leer como texto plano
    const text = fs.readFileSync(filePath, 'utf8');
    return text;
  } catch (e) {
    console.error(`[!] Error parseando ${ext}:`, e.message);
    return `# ${filename.toUpperCase()}\n\n[Error al leer el documento: ${e.message}]`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// BASE DE DATOS SUPABASE (con fallback a JSON en disco)
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
let supabase = null;
let dbEnabled = false;

async function initDatabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    // Verificar conexión haciendo una query simple
    const { error } = await supabase.from('conversations').select('id', { count: 'exact', head: true });
    if (error && error.code !== '42P01') { // 42P01 = tabla no existe (esperado si no creada aún)
      console.error('[!] Supabase error:', error.message);
      return false;
    }
    dbEnabled = true;
    console.log('[🐘] Supabase conectado');
    return true;
  } catch (e) {
    console.error('[!] Supabase no disponible:', e.message);
    dbEnabled = false;
    supabase = null;
    return false;
  }
}

async function saveMessageToDb(phone, name, role, content, provider, usedFallback, usedTopic) {
  if (!dbEnabled || !supabase) return;
  try {
    await supabase.from('conversations').insert({
      phone,
      role,
      content: content.substring(0, 2000),
      provider: provider || null,
      used_fallback: !!usedFallback,
      used_topic: usedTopic || null
    });
    // Upsert contact
    const { data: existing } = await supabase.from('contacts').select('message_count').eq('phone', phone).single();
    if (existing) {
      await supabase.from('contacts').update({
        name: name || existing.name,
        last_seen: new Date().toISOString(),
        message_count: (existing.message_count || 0) + 1
      }).eq('phone', phone);
    } else {
      await supabase.from('contacts').insert({
        phone,
        name: name || null,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        message_count: 1
      });
    }
  } catch (e) {
    console.error('[!] Error guardando en Supabase:', e.message);
  }
}

async function getContactHistory(phone, limit = 10) {
  if (!dbEnabled || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data || []).reverse();
  } catch (e) {
    return [];
  }
}

async function saveTransaction(phone, type, amount, description, category) {
  if (!dbEnabled || !supabase) return false;
  try {
    await supabase.from('transactions').insert({
      phone,
      type,
      amount,
      description: description || null,
      category: category || null
    });
    return true;
  } catch (e) {
    console.error('[!] Error guardando transacción:', e.message);
    return false;
  }
}

async function getBalance(phone) {
  if (!dbEnabled || !supabase) return null;
  try {
    const { data: ingresos } = await supabase
      .from('transactions')
      .select('amount')
      .eq('phone', phone)
      .eq('type', 'ingreso');
    const { data: gastos } = await supabase
      .from('transactions')
      .select('amount')
      .eq('phone', phone)
      .eq('type', 'gasto');
    const totalIngresos = (ingresos || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalGastos = (gastos || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    return { ingresos: totalIngresos, gastos: totalGastos };
  } catch (e) {
    return null;
  }
}

async function updateAnalyticsDaily(messagesDelta, usersDelta, fallbackDelta) {
  if (!dbEnabled || !supabase) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase.from('analytics').select('*').eq('date', today).single();
    if (existing) {
      await supabase.from('analytics').update({
        messages: (existing.messages || 0) + messagesDelta,
        unique_users: Math.max(existing.unique_users || 0, usersDelta),
        fallback_count: (existing.fallback_count || 0) + fallbackDelta
      }).eq('date', today);
    } else {
      await supabase.from('analytics').insert({
        date: today,
        messages: messagesDelta,
        unique_users: usersDelta,
        fallback_count: fallbackDelta
      });
    }
  } catch (e) {
    console.error('[!] Error actualizando analytics:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// CRM - GESTIÓN DE CLIENTES Y LEADS
// ═══════════════════════════════════════════════════════════════════

async function updateContactStatus(phone, status) {
  if (!dbEnabled || !supabase) return false;
  try {
    await supabase.from('contacts').update({ status }).eq('phone', phone);
    return true;
  } catch (e) {
    console.error('[!] Error actualizando estado:', e.message);
    return false;
  }
}

async function addContactTag(phone, tag) {
  if (!dbEnabled || !supabase) return false;
  try {
    const { data: contact } = await supabase.from('contacts').select('tags').eq('phone', phone).single();
    const currentTags = contact?.tags || [];
    if (!currentTags.includes(tag)) {
      await supabase.from('contacts').update({ tags: [...currentTags, tag] }).eq('phone', phone);
    }
    return true;
  } catch (e) {
    console.error('[!] Error agregando etiqueta:', e.message);
    return false;
  }
}

async function getContact(phone) {
  if (!dbEnabled || !supabase) return null;
  try {
    const { data } = await supabase.from('contacts').select('*').eq('phone', phone).single();
    return data;
  } catch (e) {
    return null;
  }
}

async function listContacts(status = null, limit = 50) {
  if (!dbEnabled || !supabase) return [];
  try {
    let query = supabase.from('contacts').select('*').order('last_seen', { ascending: false }).limit(limit);
    if (status) query = query.eq('status', status);
    const { data } = await query;
    return data || [];
  } catch (e) {
    return [];
  }
}

// Auto-clasificación de leads basada en intención del mensaje
function autoClassifyLead(text) {
  const lower = text.toLowerCase();
  const tags = [];
  
  // Palabras de compra/urgencia
  const hotWords = ['comprar', 'quiero', 'necesito', 'urgente', 'hoy', 'ya', 'precio', 'cotizar', 'cotización', 'cuanto cuesta', 'cuánto cuesta', 'presupuesto', 'orden', 'encargar'];
  const warmWords = ['información', 'info', 'dime', 'cuéntame', 'cómo funciona', 'que incluye', 'que ofrecen', 'servicios', 'opciones'];
  const coldWords = ['hola', 'buenas', 'saludos', 'que tal', 'buen dia', 'buenos dias'];
  
  const hasHot = hotWords.some(w => lower.includes(w));
  const hasWarm = warmWords.some(w => lower.includes(w));
  const hasCold = coldWords.some(w => lower.includes(w));
  
  if (hasHot) tags.push('lead_caliente');
  else if (hasWarm) tags.push('lead_tibio');
  else if (hasCold && text.length < 30) tags.push('lead_frio');
  
  // Detectar interés específico por tema
  if (/\b(soldadura|soldar|electrodo|mig|tig)\b/.test(lower)) tags.push('interes_soldadura');
  if (/\b(web|página|pagina|sitio|landing|ecommerce|tienda online)\b/.test(lower)) tags.push('interes_web');
  if (/\b(construcción|construccion|estructura|concreto|acero)\b/.test(lower)) tags.push('interes_construccion');
  if (/\b(herrería|herreria|puerta|ventana|portón|porton)\b/.test(lower)) tags.push('interes_herreria');
  if (/\b(legal|ley|contrato|abogado|demanda|juicio)\b/.test(lower)) tags.push('interes_legal');
  if (/\b(contable|contabilidad|impuesto|itbis|dgii|factura)\b/.test(lower)) tags.push('interes_contable');
  
  return tags;
}

// Inicializar DB al arrancar (no bloqueante)
initDatabase().then(ok => {
  if (!ok) console.log('[🐘] Supabase no configurado. Usando JSON en disco como fallback.');
});

// ═══════════════════════════════════════════════════════════════════
// SISTEMA DE CONOCIMIENTO v2.0 - RAG LITE (Chunking + TF-IDF)
// ═══════════════════════════════════════════════════════════════════

const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
let knowledgeBase = new Map(); // { topic: fullContent }
let knowledgeIndex = []; // [{ file, topic, keywords, preview }]
let knowledgeChunks = []; // [{ topic, text, keywords, tfidf }]
let idfCache = new Map(); // { word: idfScore }

// Stopwords en español
const STOPWORDS = new Set(['este','esta','estos','estas','ese','esa','esos','esas','aquel','aquella',
  'para','como','con','que','los','las','del','por','una','uno','pero','más','desde','todos','todas',
  'este','esta','esto','estos','estas','ese','esa','eso','esos','esas','aquel','aquella','aquello',
  'aquellos','aquellas','el','la','lo','le','les','me','te','se','nos','os','mi','tu','su','sus',
  'mis','tus','nuestro','nuestra','nuestros','nuestras','vuestro','vuestra','vuestros','vuestras',
  'y','o','u','e','ni','pero','sino','mas','aunque','porque','pues','ya','si','no','tambien','tampoco',
  'a','ante','bajo','con','contra','de','desde','en','entre','hacia','hasta','para','por','segun',
  'sin','sobre','tras','durante','mediante','excepto','salvo','tan','tanto','muy','mucho','poco',
  'mas','menos','algo','nada','casi','solo','sólo','cada','otro','otra','otros','otras','mismo',
  'misma','mismos','mismas','tal','tales','cual','cuales','donde','cuando','como','quien','quienes',
  'cuyo','cuya','cuyos','cuyas','ser','estar','haber','tener','hacer','poder','decir','ir','ver',
  'dar','saber','querer','llegar','pasar','deber','poner','parecer','quedar','creer','hablar',
  'llevar','dejar','seguir','encontrar','llamar','venir','pensar','salir','volver','tomar','conocer',
  'sentir','tratar','mirar','contar','empezar','esperar','buscar','existir','entrar','trabajar',
  'escribir','perder','producir','ocurrir','entender','pedir','recibir','recordar','terminar',
  'permitir','aparecer','conseguir','comenzar','servir','sacar','necesitar','mantener','resultar',
  'leer','caer','cambiar','presentar','crear','abrir','considerar','oír','acabar','convertir',
  'ganar','formar','traer','partir','morir','aceptar','realizar','suponer','comprender',
  'lograr','explicar','mostrar','preguntar','tocar','reconocer','estudiar','alcanzar','nacer',
  'cubrir','importar','cortar','correr','aprovechar','evitar','enviar','analizar','aumentar',
  'demostrar','jugar','parecer','usar','tener','ser','hacer','poder','decir','ir','ver','dar']);

function extractKeywords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñ\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .filter(w => !STOPWORDS.has(w));
}

// Dividir documento en chunks con overlap
function chunkDocument(text, chunkSize = 600, overlap = 150) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);
  
  // Estrategia 1: Si hay párrafos pequeños, agruparlos
  let currentChunk = '';
  for (const para of paragraphs) {
    if (currentChunk.length + para.length < chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = para;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  
  // Estrategia 2: Si un chunk es muy grande, dividirlo por oraciones
  const finalChunks = [];
  for (const chunk of chunks) {
    if (chunk.length <= chunkSize * 1.5) {
      finalChunks.push(chunk);
      continue;
    }
    // Dividir por oraciones
    const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
    let sentenceChunk = '';
    for (const sent of sentences) {
      if (sentenceChunk.length + sent.length < chunkSize) {
        sentenceChunk += sent;
      } else {
        if (sentenceChunk) finalChunks.push(sentenceChunk.trim());
        sentenceChunk = sent;
      }
    }
    if (sentenceChunk) finalChunks.push(sentenceChunk.trim());
  }
  
  return finalChunks.length > 0 ? finalChunks : [text.substring(0, chunkSize)];
}

// Calcular TF (Term Frequency) para un documento
function computeTf(words) {
  const tf = new Map();
  for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);
  const maxFreq = Math.max(...tf.values(), 1);
  for (const [w, freq] of tf) tf.set(w, freq / maxFreq);
  return tf;
}

// Calcular IDF (Inverse Document Frequency) para todo el corpus
function computeIdf(allDocsWords) {
  const idf = new Map();
  const N = allDocsWords.length;
  // Contar en cuántos documentos aparece cada palabra
  const docFreq = new Map();
  for (const words of allDocsWords) {
    const unique = new Set(words);
    for (const w of unique) docFreq.set(w, (docFreq.get(w) || 0) + 1);
  }
  for (const [w, df] of docFreq) {
    idf.set(w, Math.log(N / (df + 1)) + 1);
  }
  return idf;
}

// Score TF-IDF entre query y documento
function tfidfScore(queryWords, docTf, idf) {
  let score = 0;
  for (const w of queryWords) {
    const tf = docTf.get(w) || 0;
    const idfVal = idf.get(w) || 1;
    score += tf * idfVal;
  }
  return score;
}

function loadKnowledge() {
  try {
    if (!fs.existsSync(KNOWLEDGE_DIR)) {
      fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
      return;
    }
    knowledgeBase = new Map();
    knowledgeIndex = [];
    knowledgeChunks = [];
    idfCache = new Map();
    
    const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    const allChunksWords = []; // Para IDF
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8');
      const keywords = extractKeywords(content);
      const topic = file.replace(/\.(md|txt)$/, '').toLowerCase();
      knowledgeBase.set(topic, content);
      
      knowledgeIndex.push({
        file,
        topic,
        keywords: [...new Set([...keywords, topic])].slice(0, 30),
        preview: content.substring(0, 200).replace(/\n/g, ' ')
      });
      
      // Chunking
      const chunks = chunkDocument(content, 600, 150);
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        const chunkKeywords = extractKeywords(chunkText);
        const chunkWords = [...chunkKeywords, ...topic.split(/[_\-]/)];
        allChunksWords.push(chunkWords);
        knowledgeChunks.push({
          topic,
          file,
          chunkIndex: i,
          text: chunkText,
          keywords: chunkKeywords,
          wordList: chunkWords
        });
      }
    }
    
    // Calcular IDF global
    idfCache = computeIdf(allChunksWords);
    
    // Calcular TF para cada chunk
    for (const chunk of knowledgeChunks) {
      chunk.tf = computeTf(chunk.wordList);
    }
    
    console.log(`[📚] Conocimiento cargado: ${knowledgeIndex.length} temas, ${knowledgeChunks.length} chunks`);
    for (const k of knowledgeIndex) {
      const chunkCount = knowledgeChunks.filter(c => c.topic === k.topic).length;
      console.log(`   • ${k.file} (${k.keywords.length} keywords, ${chunkCount} chunks)`);
    }
  } catch (e) {
    console.error('[!] Error cargando conocimiento:', e.message);
  }
}

function findRelevantKnowledge(userText, maxChars = 2500) {
  const userWords = extractKeywords(userText);
  if (userWords.length === 0) return null;
  
  // Calcular TF-IDF score para cada chunk
  const scoredChunks = [];
  for (const chunk of knowledgeChunks) {
    const score = tfidfScore(userWords, chunk.tf, idfCache);
    // Bonus por coincidencia de topic
    for (const w of userWords) {
      if (chunk.topic.includes(w)) score += 0.5;
    }
    if (score > 0) scoredChunks.push({ chunk, score });
  }
  
  // Ordenar por score descendente
  scoredChunks.sort((a, b) => b.score - a.score);
  
  // Tomar top chunks hasta alcanzar maxChars
  let totalChars = 0;
  const selectedChunks = [];
  for (const { chunk, score } of scoredChunks) {
    if (totalChars + chunk.text.length > maxChars) break;
    // Evitar chunks duplicados del mismo tema con texto muy similar
    const isDuplicate = selectedChunks.some(c => 
      c.topic === chunk.topic && 
      (c.text.includes(chunk.text.substring(0, 50)) || chunk.text.includes(c.text.substring(0, 50)))
    );
    if (!isDuplicate) {
      selectedChunks.push(chunk);
      totalChars += chunk.text.length;
    }
  }
  
  if (selectedChunks.length === 0) return null;
  
  // Construir contexto
  const parts = selectedChunks.map(c => `[${c.topic}]\n${c.text}`);
  return parts.join('\n\n---\n\n');
}

function reloadKnowledge() {
  loadKnowledge();
  return { loaded: knowledgeIndex.length, chunks: knowledgeChunks.length, topics: knowledgeIndex.map(k => k.topic) };
}

// ═══════════════════════════════════════════════════════════════════
// LIMPIEZA PERIÓDICA
// ═══════════════════════════════════════════════════════════════════

function cleanupOldData() {
  const now = Date.now();
  let cleanedConv = 0;
  let cleanedRate = 0;

  if (conversations.size > 500) {
    const entries = Array.from(conversations.entries());
    const toDelete = entries.slice(0, entries.length - 500);
    for (const [key] of toDelete) {
      conversations.delete(key);
      cleanedConv++;
    }
  }

  for (const [userId, timestamp] of rateLimits.entries()) {
    if (now - timestamp > 3600000) {
      rateLimits.delete(userId);
      cleanedRate++;
    }
  }

  if (cleanedConv > 0 || cleanedRate > 0) {
    console.log(`[🧹] Limpieza: ${cleanedConv} conversaciones, ${cleanedRate} rate limits`);
  }
}

setInterval(cleanupOldData, CLEANUP_INTERVAL_MS);

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function getDisplayId(jid) {
  if (!jid) return 'desconocido';
  return jid.split('@')[0];
}

function isValidUserJid(jid) {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '... [mensaje truncado]';
}

// ═══════════════════════════════════════════════════════════════════
// API HTTP
// ═══════════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.json({
    status: isConnected ? 'connected' : 'disconnected',
    connected: isConnected,
    phone: botPhoneNumber,
    qrAvailable: !!qrCodeData,
    queueSize: messageQueue.length,
    activeConversations: conversations.size,
    humanModeUsers: humanMode.size,
    circuits: getCircuitStatus(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  // Healthcheck básico: solo verifica que el servidor Express está vivo
  // Railway usa esto para saber si debe reiniciar el contenedor
  res.status(200).json({
    status: 'healthy',
    server: 'up',
    connected: isConnected,
    uptime: process.uptime(),
    queueSize: messageQueue.length,
    timestamp: new Date().toISOString()
  });
});

app.get('/status', (req, res) => {
  // Estado completo incluyendo conexión WhatsApp
  const healthy = isConnected && sock !== null;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'connected' : 'disconnected',
    connected: isConnected,
    uptime: process.uptime(),
    queueSize: messageQueue.length,
    timestamp: new Date().toISOString()
  });
});

app.post('/send', requireAuth, async (req, res) => {
  try {
    const { to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: 'Faltan campos: to, text' });
    if (!isConnected || !sock) return res.status(503).json({ error: 'WhatsApp no conectado' });
    await sendWhatsAppMessage(to, text);
    res.json({ success: true, to, sent: true });
  } catch (err) {
    console.error('[!] Error en /send:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/qr', (req, res) => {
  if (!qrCodeData) {
    // Si es navegador, mostrar página HTML; si no, JSON
    const accept = req.headers.accept || '';
    if (accept.includes('text/html')) {
      return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp QR - Necio Bot</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff;text-align:center;padding:20px}h1{margin-bottom:10px}p{color:#aaa}.loader{border:4px solid #333;border-top:4px solid #0f0;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>
<script>setInterval(()=>location.reload(),3000)</script>
</head><body><h1>⏳ Generando QR...</h1><div class="loader"></div><p>Espera unos segundos y recarga la página.</p></body></html>`);
    }
    return res.status(404).json({ error: 'QR no disponible' });
  }

  QRCode.toDataURL(qrCodeData, { width: 400, margin: 2 })
    .then(url => {
      const accept = req.headers.accept || '';
      if (accept.includes('text/html')) {
        // Mostrar página HTML con el QR
        res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp QR - Necio Bot</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;text-align:center;padding:20px}h1{margin-bottom:10px}img{max-width:90vw;border-radius:12px;box-shadow:0 0 40px rgba(0,255,0,.3)}p{color:#aaa;margin-top:15px}.refresh{color:#0f0;font-size:14px;margin-top:20px}</style>
<script>setInterval(()=>fetch('/').then(r=>r.json()).then(d=>{if(!d.qrAvailable)location.reload()}),5000)</script>
</head><body><h1>📱 Escanea con WhatsApp</h1><img src="${url}" alt="QR Code"><p>Ajustes → Dispositivos vinculados → Vincular dispositivo</p><p class="refresh">⏳ Este QR se actualiza automáticamente</p></body></html>`);
      } else {
        res.json({ qr: url, raw: qrCodeData });
      }
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
    const filePath = path.join(KNOWLEDGE_DIR, safeName + ext);
    fs.writeFileSync(filePath, content, 'utf8');
    reloadKnowledge();
    res.json({ success: true, file: safeName + ext, topics: knowledgeIndex.map(k => k.topic) });
  } catch (err) {
    console.error('[!] Error subiendo conocimiento:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/reload-knowledge', requireAuth, (req, res) => {
  const result = reloadKnowledge();
  res.json({ success: true, ...result });
});

app.get('/knowledge', requireAuth, (req, res) => {
  res.json({
    topics: knowledgeIndex.map(k => ({ topic: k.topic, file: k.file, keywords: k.keywords.slice(0, 10), chunks: knowledgeChunks.filter(c => c.topic === k.topic).length })),
    total: knowledgeIndex.length,
    chunks: knowledgeChunks.length
  });
});

app.get('/stats', requireAuth, (req, res) => {
  resetDailyStats();
  res.json({
    messagesTotal: analytics.messagesTotal,
    messagesToday: analytics.messagesToday,
    uniqueUsers: analytics.uniqueUsers.size,
    privateMessages: analytics.privateMessages,
    groupMessages: analytics.groupMessages,
    fallbackCount: analytics.fallbackCount,
    topicsUsed: [...analytics.topicsUsed.entries()].sort((a, b) => b[1] - a[1]),
    iaProviderUsage: [...analytics.iaProviderUsage.entries()].sort((a, b) => b[1] - a[1]),
    knowledge: {
      topics: knowledgeIndex.length,
      chunks: knowledgeChunks.length
    },
    circuits: getCircuitStatus(),
    uptime: process.uptime()
  });
});

// ─── Multer config para subir archivos ───
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, KNOWLEDGE_DIR),
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// ─── Página web pública para gestionar conocimiento ───
app.get('/learn', async (req, res) => {
  const topics = knowledgeIndex.map(k => {
    const chunkCount = knowledgeChunks.filter(c => c.topic === k.topic).length;
    return `<li><b>${k.topic}</b> <span style="color:#888;font-size:12px">(${k.file} · ${chunkCount} chunks)</span></li>`;
  }).join('') || '<li style="color:#888">No hay temas aún</li>';
  
  const topTopics = [...analytics.topicsUsed.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, c]) => `<li>${t}: <b>${c}</b> consultas</li>`)
    .join('') || '<li style="color:#888">Sin datos aún</li>';
  
  const topProviders = [...analytics.iaProviderUsage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `<li>${p}: <b>${c}</b></li>`)
    .join('') || '<li style="color:#888">Sin datos aún</li>';
  
  // Obtener clientes de Supabase para el panel
  let clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">Cargando...</td></tr>';
  try {
    if (dbEnabled && supabase) {
      const { data: clients } = await supabase.from('contacts').select('*').order('last_seen', { ascending: false }).limit(20);
      if (clients && clients.length > 0) {
        clientsHtml = clients.map(c => `<tr>
          <td>${c.name || 'Sin nombre'}</td>
          <td>${c.phone.split('@')[0]}</td>
          <td><span class="badge badge-${c.status || 'nuevo'}">${c.status || 'nuevo'}</span></td>
          <td>${c.tags?.join(', ') || '-'}</td>
          <td>${c.message_count || 0}</td>
        </tr>`).join('');
      } else {
        clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">No hay clientes aún</td></tr>';
      }
    } else {
      clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">Supabase no conectado</td></tr>';
    }
  } catch (e) {
    clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">Error cargando clientes</td></tr>';
  }
  
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📚 Enseñar al Bot - Necio Digital</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f23;color:#e0e0e0;max-width:900px;margin:0 auto;padding:20px;line-height:1.6}
h1{color:#00d4ff;text-align:center;margin-bottom:5px}
.sub{text-align:center;color:#888;font-size:14px;margin-bottom:30px}
.card{background:#1a1a2e;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #2a2a4e}
.card h2{color:#00d4ff;margin-top:0;font-size:18px}
label{display:block;margin:12px 0 5px;color:#aaa;font-size:13px;text-transform:uppercase;letter-spacing:1px}
input[type=text],textarea{width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#0f0f23;color:#e0e0e0;font-size:14px}
textarea{min-height:180px;resize:vertical;font-family:inherit}
input[type=file]{padding:10px 0;color:#ccc}
.btn{background:#00d4ff;color:#000;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;margin-top:10px}
.btn:hover{background:#00b8e6}
.btn-secondary{background:#2a2a4e;color:#e0e0e0}
.btn-secondary:hover{background:#3a3a6e}
.topics{max-height:200px;overflow-y:auto;background:#0f0f23;border-radius:8px;padding:10px 15px;margin-top:10px}
.topics li{margin:6px 0}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.stat{background:#0f0f23;border-radius:8px;padding:12px;text-align:center}
.stat-value{color:#00d4ff;font-size:22px;font-weight:700}
.stat-label{color:#888;font-size:12px}
.success{color:#0f0;background:#0f0f23;padding:12px;border-radius:8px;border:1px solid #0f0;margin-bottom:15px;display:none}
.error{color:#f55;background:#0f0f23;padding:12px;border-radius:8px;border:1px solid #f55;margin-bottom:15px;display:none}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
th{text-align:left;color:#888;padding:8px;border-bottom:1px solid #333}
td{padding:8px;border-bottom:1px solid #222}
.badge{padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600}
.badge-nuevo{background:#2a2a4e;color:#aaa}
.badge-contactado{background:#1a3a4e;color:#5af}
.badge-cotizado{background:#1a3a1e;color:#5f5}
.badge-cerrado{background:#1a2a1e;color:#0f0}
.badge-perdido{background:#3a1a1e;color:#f55}
.lead-caliente{color:#f55;font-weight:600}
.lead-tibio{color:#fa0}
.lead-frio{color:#888}
small{color:#666;font-size:12px}
</style>
</head>
<body>
<h1>📚 Enseñar al Bot</h1>
<p class="sub">Agrega conocimiento para que el bot responda mejor</p>

<div id="msgSuccess" class="success"></div>
<div id="msgError" class="error"></div>

<div class="card">
  <h2>📊 Estadísticas de Uso</h2>
  <div class="stats">
    <div class="stat"><div class="stat-value">${analytics.messagesToday}</div><div class="stat-label">Mensajes hoy</div></div>
    <div class="stat"><div class="stat-value">${analytics.messagesTotal}</div><div class="stat-label">Mensajes totales</div></div>
    <div class="stat"><div class="stat-value">${analytics.uniqueUsers.size}</div><div class="stat-label">Usuarios únicos</div></div>
    <div class="stat"><div class="stat-value">${knowledgeChunks.length}</div><div class="stat-label">Chunks cargados</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:15px">
    <div>
      <h3 style="color:#888;font-size:13px;margin:0 0 8px 0">🏆 Temas más consultados</h3>
      <ul class="topics" style="max-height:150px">${topTopics}</ul>
    </div>
    <div>
      <h3 style="color:#888;font-size:13px;margin:0 0 8px 0">🤖 Uso de IAs</h3>
      <ul class="topics" style="max-height:150px">${topProviders}</ul>
    </div>
  </div>
</div>

<div class="card">
  <h2>👥 Clientes y Leads (CRM)</h2>
  <table>
    <thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Etiquetas</th><th>Msgs</th></tr></thead>
    <tbody>${clientsHtml}</tbody>
  </table>
  <small>💡 Los estados son: nuevo → contactado → cotizado → cerrado | perdido</small>
</div>

<div class="card">
  <h2>📝 Método 1: Escribir directamente</h2>
  <form id="textForm">
    <label>Nombre del tema</label>
    <input type="text" id="topicName" placeholder="ej: electricidad, plomeria, contabilidad" required>
    <label>Contenido</label>
    <textarea id="topicContent" placeholder="Escribe aquí todo lo que el bot debe saber sobre este tema..." required></textarea>
    <small>💡 Consejo: El bot divide automáticamente en chunks inteligentes. Puedes escribir textos largos.</small>
    <button type="submit" class="btn">💾 Guardar Tema</button>
  </form>
</div>

<div class="card">
  <h2>📁 Método 2: Subir archivo</h2>
  <form id="fileForm" enctype="multipart/form-data">
    <label>Archivo (.md o .txt)</label>
    <input type="file" id="fileInput" accept=".md,.txt,.pdf,.docx,.xlsx,.csv" required>
    <small>El nombre del archivo será el nombre del tema.</small>
    <button type="submit" class="btn btn-secondary">📤 Subir Archivo</button>
  </form>
</div>

<div class="card">
  <h2>📋 Temas actuales (${knowledgeIndex.length} temas · ${knowledgeChunks.length} chunks)</h2>
  <ul class="topics">${topics}</ul>
  <button class="btn btn-secondary" onclick="reloadKnowledge()">🔄 Recargar Conocimiento</button>
</div>

<script>
const API_KEY = 'neciobot2026seguro';

function show(id, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

document.getElementById('textForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('topicName').value.trim();
  const content = document.getElementById('topicContent').value.trim();
  if (!name || !content) return;
  try {
    const res = await fetch('/upload-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ filename: name + '.md', content })
    });
    const data = await res.json();
    if (data.success) {
      show('msgSuccess', '✅ Tema guardado: ' + data.file);
      document.getElementById('topicName').value = '';
      document.getElementById('topicContent').value = '';
      setTimeout(() => location.reload(), 1500);
    } else {
      show('msgError', '❌ Error: ' + (data.error || 'desconocido'));
    }
  } catch (err) {
    show('msgError', '❌ Error de red: ' + err.message);
  }
};

document.getElementById('fileForm').onsubmit = async (e) => {
  e.preventDefault();
  const file = document.getElementById('fileInput').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('knowledge', file);
  try {
    const res = await fetch('/upload-file', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
      body: form
    });
    const data = await res.json();
    if (data.success) {
      show('msgSuccess', '✅ Archivo subido: ' + data.file);
      document.getElementById('fileInput').value = '';
      setTimeout(() => location.reload(), 1500);
    } else {
      show('msgError', '❌ Error: ' + (data.error || 'desconocido'));
    }
  } catch (err) {
    show('msgError', '❌ Error de red: ' + err.message);
  }
};

async function reloadKnowledge() {
  try {
    const res = await fetch('/reload-knowledge', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
    const data = await res.json();
    if (data.success) {
      show('msgSuccess', '🔄 Recargado: ' + data.loaded + ' temas, ' + data.chunks + ' chunks');
      setTimeout(() => location.reload(), 1000);
    }
  } catch (err) {
    show('msgError', '❌ ' + err.message);
  }
}
</script>
</body>
</html>`);
});

// ─── Subir archivo con multer ───
app.post('/upload-file', requireAuth, upload.single('knowledge'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    const originalName = req.file.originalname.replace(/\.[^.]+$/, '');
    const safeName = originalName.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]/g, '_').toLowerCase();
    const ext = path.extname(req.file.originalname).toLowerCase();
    const finalName = safeName + '.md';
    const finalPath = path.join(KNOWLEDGE_DIR, finalName);
    
    // Si es PDF, DOCX, XLSX → parsear a markdown
    if (['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv'].includes(ext)) {
      console.log(`[📄] Parseando ${ext} a markdown...`);
      const markdown = await parseDocument(req.file.path);
      fs.writeFileSync(finalPath, markdown, 'utf8');
      fs.unlinkSync(req.file.path); // Borrar archivo original
    } else {
      // .md o .txt → mover directamente
      fs.renameSync(req.file.path, finalPath);
    }
    
    reloadKnowledge();
    res.json({ success: true, file: finalName, topics: knowledgeIndex.map(k => k.topic) });
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
    humanMode.add(normalized);
  } else {
    humanMode.delete(normalized);
  }
  res.json({ success: true, phone, humanMode: active });
});

// ═══════════════════════════════════════════════════════════════════
// WHATSAPP HELPERS
// ═══════════════════════════════════════════════════════════════════

async function sendWhatsAppMessage(to, text, options = {}) {
  if (!sock) throw new Error('WhatsApp no conectado');
  const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
  const content = String(text);

  // ─── Anti-ban: delay humanizado + typing con variación ───────
  if (ANTI_BAN_ENABLED && options.simulateTyping !== false && sock) {
    const wordCount = content.split(/\s+/).length;
    const typingDurationMs = Math.max(
      TYPING_DELAY_MIN_MS,
      Math.min(
        TYPING_DELAY_MAX_MS,
        (wordCount / TYPING_SPEED_WPM) * 60 * 1000 * (0.8 + Math.random() * 0.4)
      )
    );
    // 20% de las veces NO mostramos typing (más natural)
    const showTyping = Math.random() > 0.2;
    if (showTyping) {
      const chunks = Math.max(1, Math.floor(typingDurationMs / 3000));
      typingInProgress.add(jid);
      try {
        for (let i = 0; i < chunks; i++) {
          if (!typingInProgress.has(jid)) break;
          await sock.sendPresenceUpdate('composing', jid);
          await new Promise(r => setTimeout(r, Math.min(3000, typingDurationMs / chunks)));
        }
        // A veces mostramos "paused" antes de enviar
        if (Math.random() > 0.5) {
          await sock.sendPresenceUpdate('paused', jid);
          await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
        }
      } catch (e) {
        // ignorar errores de typing
      }
      typingInProgress.delete(jid);
    }
    // Pausa final antes de enviar (siempre, incluso sin typing)
    await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
  }

  let lastError = null;
  for (let attempt = 1; attempt <= RETRY_SEND_MAX; attempt++) {
    try {
      await sock.sendMessage(jid, { text: content });
      return;
    } catch (err) {
      lastError = err;
      console.error(`[!] Error enviando mensaje (intento ${attempt}/${RETRY_SEND_MAX}):`, err.message);
      if (attempt < RETRY_SEND_MAX) {
        const jitter = 1000 * attempt + Math.floor(Math.random() * 1000);
        await new Promise(r => setTimeout(r, jitter));
      }
    }
  }
  throw lastError || new Error('No se pudo enviar el mensaje');
}

// ═══════════════════════════════════════════════════════════════════
// HTTP HELPER (genérico para todas las IAs)
// ═══════════════════════════════════════════════════════════════════

function httpRequest(options, data) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' || !options.protocol ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            return;
          }
          resolve({ status: res.statusCode, body: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });

    if (data) req.write(data);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════
// IA: GROQ
// ═══════════════════════════════════════════════════════════════════

async function askGroq(messages) {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY no configurada');

  const data = JSON.stringify({
    model: GROQ_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 200
  });

  const options = {
    hostname: 'api.groq.com',
    path: '/openai/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  return res.body?.choices?.[0]?.message?.content || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: GOOGLE GEMINI
// ═══════════════════════════════════════════════════════════════════

async function askGemini(messages) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada');

  // Convertir formato OpenAI a Gemini
  const contents = [];
  let systemText = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += msg.content + '\n';
      continue;
    }
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    });
  }

  // Si hay system prompt, agregarlo al primer mensaje user
  if (systemText && contents.length > 0 && contents[0].role === 'user') {
    contents[0].parts[0].text = systemText + contents[0].parts[0].text;
  }

  const data = JSON.stringify({ contents });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  const text = res.body?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: OPENROUTER
// ═══════════════════════════════════════════════════════════════════

async function askOpenRouter(messages) {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY no configurada');

  const data = JSON.stringify({
    model: OPENROUTER_MODEL,
    messages,
    max_tokens: 200
  });

  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://necio-digital.com',
      'X-Title': 'Necio WhatsApp Bot',
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  return res.body?.choices?.[0]?.message?.content || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: MISTRAL
// ═══════════════════════════════════════════════════════════════════

async function askMistral(messages) {
  if (!MISTRAL_API_KEY) throw new Error('MISTRAL_API_KEY no configurada');

  const data = JSON.stringify({
    model: MISTRAL_MODEL,
    messages,
    max_tokens: 200
  });

  const options = {
    hostname: 'api.mistral.ai',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_API_KEY}`,
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  return res.body?.choices?.[0]?.message?.content || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: CEREBRAS (1.5M tokens/day gratis)
// ═══════════════════════════════════════════════════════════════════

async function askCerebras(messages) {
  if (!CEREBRAS_API_KEY) throw new Error('CEREBRAS_API_KEY no configurada');

  const data = JSON.stringify({
    model: CEREBRAS_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 200
  });

  const options = {
    hostname: 'api.cerebras.ai',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  return res.body?.choices?.[0]?.message?.content || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: TOGETHER AI (1M tokens/month gratis)
// ═══════════════════════════════════════════════════════════════════

async function askTogether(messages) {
  if (!TOGETHER_API_KEY) throw new Error('TOGETHER_API_KEY no configurada');

  const data = JSON.stringify({
    model: TOGETHER_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 200
  });

  const options = {
    hostname: 'api.together.xyz',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOGETHER_API_KEY}`,
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  return res.body?.choices?.[0]?.message?.content || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: GITHUB MODELS (50 chat + 2K completions/month gratis)
// ═══════════════════════════════════════════════════════════════════

async function askGitHubModels(messages) {
  if (!GITHUB_MODELS_TOKEN) throw new Error('GITHUB_MODELS_TOKEN no configurada');

  const data = JSON.stringify({
    model: GITHUB_MODELS_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 200
  });

  const options = {
    hostname: 'models.inference.ai.azure.com',
    path: '/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GITHUB_MODELS_TOKEN}`,
      'Content-Length': Buffer.byteLength(data)
    },
    timeout: AI_TIMEOUT_MS
  };

  const res = await httpRequest(options, data);
  return res.body?.choices?.[0]?.message?.content || null;
}

// ═══════════════════════════════════════════════════════════════════
// IA: DISPATCHER CON FALLBACK INFINITO
// ═══════════════════════════════════════════════════════════════════

async function askAI(messages) {
  // Verificar cache primero
  const userMessage = messages[messages.length - 1]?.content || '';
  const cached = getCachedReply(userMessage);
  if (cached) return { reply: cached, provider: 'cache' };

  // Orden: Cerebras primero (1.5M tokens/día gratis), luego Groq, luego el resto
  const providers = [
    { name: 'cerebras', fn: () => askCerebras(messages), available: !!CEREBRAS_API_KEY },
    { name: 'groq', fn: () => askGroq(messages), available: !!GROQ_API_KEY },
    { name: 'gemini', fn: () => askGemini(messages), available: !!GEMINI_API_KEY },
    { name: 'openrouter', fn: () => askOpenRouter(messages), available: !!OPENROUTER_API_KEY },
    { name: 'together', fn: () => askTogether(messages), available: !!TOGETHER_API_KEY },
    { name: 'github', fn: () => askGitHubModels(messages), available: !!GITHUB_MODELS_TOKEN },
    { name: 'mistral', fn: () => askMistral(messages), available: !!MISTRAL_API_KEY },
  ].filter(p => p.available);

  if (providers.length === 0) {
    console.error('[!] Ninguna API de IA está configurada');
    return { reply: null, provider: null };
  }

  for (const provider of providers) {
    if (isCircuitOpen(provider.name)) {
      console.log(`[⚡] ${provider.name.toUpperCase()} en circuito abierto, saltando...`);
      continue;
    }

    console.log(`[🤖] Intentando ${provider.name.toUpperCase()}...`);
    const startTime = Date.now();

    try {
      const reply = await Promise.race([
        provider.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), AI_TIMEOUT_MS)
        )
      ]);

      if (reply && reply.trim().length > 0) {
        const duration = Date.now() - startTime;
        console.log(`[✅] ${provider.name.toUpperCase()} respondió en ${duration}ms`);
        recordSuccess(provider.name);
        // Guardar en cache
        setCachedReply(userMessage, reply);
        return { reply, provider: provider.name };
      }
    } catch (err) {
      const duration = Date.now() - startTime;
      console.error(`[❌] ${provider.name.toUpperCase()} falló (${duration}ms): ${err.message}`);
      recordFailure(provider.name);
    }
  }

  console.error('[☠️] TODAS las IAs fallaron. Activando respuesta de emergencia.');
  return { reply: null, provider: null };
}

// ═══════════════════════════════════════════════════════════════════
// RESPUESTA DE EMERGENCIA (fallback local)
// ═══════════════════════════════════════════════════════════════════

function generateLocalReply(text) {
  const lower = text.toLowerCase();

  // Buscar en FAQs por keyword match
  for (const faq of FAQS_DATA.faqs) {
    if (faq.keywords && faq.keywords.some(k => lower.includes(k))) {
      return faq.answer;
    }
  }

  // Respuestas genéricas naturales (no mencionan problemas técnicos)
  const responses = [
    'Dame un momento que busco eso para ti.',
    'Ya voy, déjame revisar...',
    'Un segundito, estoy en eso.',
    'Espera, voy chequeando...',
  ];

  // Elegir una basada en el hash del texto para que sea consistente
  const hash = text.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return responses[hash % responses.length];
}

// ═══════════════════════════════════════════════════════════════════
// PROCESAR MENSAJE
// ═══════════════════════════════════════════════════════════════════

// Throttle para mensajes de sistema (flood, rate limit, etc.)
const systemMessageThrottle = new Map(); // { userId: lastTimestamp }
const SYSTEM_MSG_COOLDOWN_MS = 30000; // 30 segundos entre mensajes de sistema

async function sendSystemMessage(userId, text) {
  const now = Date.now();
  const last = systemMessageThrottle.get(userId) || 0;
  if (now - last < SYSTEM_MSG_COOLDOWN_MS) return; // No spamear
  systemMessageThrottle.set(userId, now);
  await sendWhatsAppMessage(userId, text, { simulateTyping: false });
}

async function processMessage(userId, name, text) {
  // ─── Anti-ban: flood protection ────────────────────────────────
  if (ANTI_BAN_ENABLED) {
    if (isFlood(userId)) {
      console.log(`[🚫] Ignorando flood de ${getDisplayId(userId)}`);
      await sendSystemMessage(userId, '⏳ Estás enviando mensajes muy rápido. Dame un momento y te respondo.');
      return;
    }
    if (isSpam(userId, text)) {
      console.log(`[🚫] Ignorando spam de ${getDisplayId(userId)}`);
      await sendSystemMessage(userId, '📝 Noté que estás repitiendo el mismo mensaje. ¿Hay algo más en lo que pueda ayudarte?');
      return;
    }
    if (isAggressivePattern(text)) {
      console.log(`[🚫] Patrón agresivo detectado de ${getDisplayId(userId)}`);
      await sendWhatsAppMessage(userId, 'Entiendo tu mensaje. Dame un momento para revisarlo. 😊', { simulateTyping: false });
      return;
    }
    recordMessage(userId);
  }

  // ─── Modo aprendizaje: el usuario está enviando contenido para un tema ───
  const learnState = learningMode.get(userId);
  if (learnState && learnState.step === 'waiting_content') {
    const topic = learnState.topic;
    const safeName = topic.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]/g, '_').toLowerCase();
    const filePath = path.join(KNOWLEDGE_DIR, safeName + '.md');
    const header = `# ${topic.toUpperCase()}\n\n`;
    const fullContent = header + text.trim();
    try {
      fs.writeFileSync(filePath, fullContent, 'utf8');
      reloadKnowledge();
      await sendWhatsAppMessage(userId, `✅ ¡Aprendí *${topic}*!\n\nAhora sé sobre este tema y lo usaré cuando alguien pregunte.\n\n📚 Temas que conozco: ${knowledgeIndex.length}\n\nEscribe */temas* para ver la lista completa.`, { simulateTyping: false });
      console.log(`[📚] Nuevo conocimiento agregado por ${getDisplayId(userId)}: ${safeName}.md`);
    } catch (e) {
      await sendWhatsAppMessage(userId, `❌ No pude guardar el tema. Error: ${e.message}`, { simulateTyping: false });
    }
    learningMode.delete(userId);
    return;
  }

  // Comando ayuda
  if (text.trim().toLowerCase() === '/ayuda' || text.trim().toLowerCase() === '/help') {
    await sendWhatsAppMessage(userId, `🤖 *Comandos disponibles:*\n\n*Generales:*\n• */ayuda* - Ver esta lista\n• */humano* - Hablar con una persona\n• */bot* - Reactivarme\n• */estado* - Ver si estoy conectado\n\n*Conocimiento:*\n• */temas* - Ver lo que sé\n• */aprender [tema]* - Enseñarme algo nuevo\n• */olvidar [tema]* - Borrar un tema\n\n*CRM / Clientes:*\n• */cliente [nombre]* - Registrar tu nombre\n• */estado [nuevo|contactado|cotizado|cerrado|perdido]* - Cambiar estado\n• */etiqueta [tag]* - Agregar etiqueta\n• */miinfo* - Ver tu perfil\n• */historial* - Ver conversaciones recientes\n• */clientes* - Listar todos (admin)\n\n*Finanzas:*\n• */ingreso [monto] [desc]* - Registrar ingreso\n• */gasto [monto] [desc]* - Registrar gasto\n• */balance* - Ver finanzas\n\n*Admin:*\n• */stats* - Estadísticas completas\n\n📚 Web: https://necio-whatsapp-bot-v3-production.up.railway.app/learn\n\n¿En qué puedo ayudarte?`, { simulateTyping: false });
    return;
  }

  // Comando estado
  if (text.trim().toLowerCase() === '/estado') {
    const status = isConnected ? '🟢 Conectado y listo' : '🔴 Desconectado';
    await sendWhatsAppMessage(userId, `${status}\n📅 ${new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })}`, { simulateTyping: false });
    return;
  }

  // Comando /stats - estadísticas del bot (solo admin)
  if (text.trim().toLowerCase() === '/stats') {
    const isAdmin = userId.includes(ADMIN_WHATSAPP.replace(/\D/g, ''));
    if (!isAdmin) {
      await sendWhatsAppMessage(userId, '⛔ Solo el admin puede ver estadísticas.', { simulateTyping: false });
      return;
    }
    const topTopics = [...analytics.topicsUsed.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `• ${t}: ${c}`)
      .join('\n') || 'Ninguno aún';
    const topProviders = [...analytics.iaProviderUsage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `• ${p}: ${c}`)
      .join('\n') || 'Ninguno aún';
    await sendWhatsAppMessage(userId, `📊 *Estadísticas del Bot*

📨 Mensajes hoy: ${analytics.messagesToday}
📨 Mensajes totales: ${analytics.messagesTotal}
👤 Usuarios únicos: ${analytics.uniqueUsers.size}
💬 Privados: ${analytics.privateMessages} | Grupos: ${analytics.groupMessages}
🆘 Fallbacks: ${analytics.fallbackCount}

🏆 *Temas más consultados:*
${topTopics}

🤖 *Uso de IAs:*
${topProviders}`, { simulateTyping: false });
    return;
  }

  // ═══ CRM COMANDOS ═══

  // Comando /cliente [nombre] - registrar/actualizar nombre
  const clienteMatch = text.trim().match(/^\/cliente\s+(.+)$/i);
  if (clienteMatch) {
    const nombre = clienteMatch[1].trim();
    const saved = await updateContactStatus(userId, null); // solo upsert
    if (dbEnabled) {
      await supabase.from('contacts').update({ name: nombre }).eq('phone', userId);
      await sendWhatsAppMessage(userId, `✅ Cliente registrado: *${nombre}*\n📱 ${getDisplayId(userId)}`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `⚠️ Modo local: Cliente *${nombre}* anotado.\nConecta Supabase para persistencia.`, { simulateTyping: false });
    }
    return;
  }

  // Comando /estado [nuevo|contactado|cotizado|cerrado|perdido]
  const estadoMatch = text.trim().match(/^\/estado\s+(nuevo|contactado|cotizado|cerrado|perdido)$/i);
  if (estadoMatch) {
    const nuevoEstado = estadoMatch[1].toLowerCase();
    const saved = await updateContactStatus(userId, nuevoEstado);
    if (saved) {
      await sendWhatsAppMessage(userId, `✅ Estado actualizado a: *${nuevoEstado.toUpperCase()}*`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `⚠️ No se pudo guardar. ¿Supabase configurado?`, { simulateTyping: false });
    }
    return;
  }

  // Comando /etiqueta [tag]
  const etiquetaMatch = text.trim().match(/^\/etiqueta\s+(.+)$/i);
  if (etiquetaMatch) {
    const tag = etiquetaMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
    const saved = await addContactTag(userId, tag);
    if (saved) {
      await sendWhatsAppMessage(userId, `🏷️ Etiqueta agregada: *${tag}*`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `⚠️ No se pudo guardar la etiqueta.`, { simulateTyping: false });
    }
    return;
  }

  // Comando /miinfo - ver mi perfil
  if (text.trim().toLowerCase() === '/miinfo') {
    const contact = await getContact(userId);
    if (contact) {
      const tags = contact.tags?.length ? contact.tags.join(', ') : 'Ninguna';
      await sendWhatsAppMessage(userId, `👤 *Tu perfil*

📱 ${getDisplayId(userId)}
📝 ${contact.name || 'Sin nombre'}
📊 Estado: ${contact.status || 'nuevo'}
🏷️ Etiquetas: ${tags}
💬 Mensajes: ${contact.message_count || 0}
📅 Primer contacto: ${new Date(contact.first_seen).toLocaleDateString('es-DO')}
📅 Último contacto: ${new Date(contact.last_seen).toLocaleDateString('es-DO')}`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `👤 No tienes perfil aún. Escribe */cliente [tu nombre]* para crearlo.`, { simulateTyping: false });
    }
    return;
  }

  // Comando /historial - ver conversaciones recientes (solo admin o el mismo usuario)
  if (text.trim().toLowerCase() === '/historial') {
    const history = await getContactHistory(userId, 10);
    if (history.length > 0) {
      const lines = history.map(h => `${h.role === 'user' ? '👤' : '🤖'} ${h.content.substring(0, 60)}...`).join('\n');
      await sendWhatsAppMessage(userId, `📜 *Últimas conversaciones:*\n\n${lines}`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `📜 No hay historial aún.`, { simulateTyping: false });
    }
    return;
  }

  // Comando /clientes - listar todos los clientes (solo admin)
  if (text.trim().toLowerCase() === '/clientes') {
    const isAdmin = userId.includes(ADMIN_WHATSAPP.replace(/\D/g, ''));
    if (!isAdmin) {
      await sendWhatsAppMessage(userId, '⛔ Solo el admin puede ver todos los clientes.', { simulateTyping: false });
      return;
    }
    const clients = await listContacts(null, 30);
    if (clients.length === 0) {
      await sendWhatsAppMessage(userId, `📋 No hay clientes registrados aún.`, { simulateTyping: false });
    } else {
      const lines = clients.map((c, i) => `${i + 1}. ${c.name || 'Sin nombre'} - ${c.phone.split('@')[0]} [${c.status}] (${c.message_count} msgs)`).join('\n');
      await sendWhatsAppMessage(userId, `📋 *Clientes (${clients.length}):*\n\n${lines}`, { simulateTyping: false });
    }
    return;
  }

  // Comando /temas - ver lo que sabe el bot
  if (text.trim().toLowerCase() === '/temas') {
    if (knowledgeIndex.length === 0) {
      await sendWhatsAppMessage(userId, `📚 Aún no sé nada.\n\nPara enseñarme:\n1. Escribe */aprender [tema]*\n2. Envíame el contenido\n\nO usa la web:\nhttps://necio-whatsapp-bot-v3-production.up.railway.app/learn`, { simulateTyping: false });
    } else {
      const list = knowledgeIndex.map((k, i) => `${i + 1}. ${k.topic}`).join('\n');
      await sendWhatsAppMessage(userId, `📚 *Temas que conozco (${knowledgeIndex.length}):*\n\n${list}\n\nPara ver uno en detalle, escribe */aprender [nombre]* y envía el contenido.`, { simulateTyping: false });
    }
    return;
  }

  // Comando /aprender [tema] - iniciar modo aprendizaje
  const learnMatch = text.trim().match(/^\/aprender\s+(.+)$/i);
  if (learnMatch) {
    const topic = learnMatch[1].trim();
    learningMode.set(userId, { topic, step: 'waiting_content' });
    await sendWhatsAppMessage(userId, `📝 *Modo aprendizaje activado: ${topic}*\n\nEnvíame todo el contenido sobre este tema en un solo mensaje (puedes escribirlo o copiar y pegar).\n\nYo lo guardaré y lo usaré cuando alguien pregunte sobre ${topic}.\n\nPara cancelar, escribe */cancelar*.`, { simulateTyping: false });
    return;
  }

  // Comando /olvidar [tema] - borrar conocimiento
  const forgetMatch = text.trim().match(/^\/olvidar\s+(.+)$/i);
  if (forgetMatch) {
    const topic = forgetMatch[1].trim().toLowerCase();
    const entry = knowledgeIndex.find(k => k.topic === topic || k.file.replace(/\.(md|txt)$/, '').toLowerCase() === topic);
    if (!entry) {
      await sendWhatsAppMessage(userId, `❌ No encontré el tema "${topic}".\n\nEscribe */temas* para ver lo que sé.`, { simulateTyping: false });
    } else {
      try {
        fs.unlinkSync(path.join(KNOWLEDGE_DIR, entry.file));
        reloadKnowledge();
        await sendWhatsAppMessage(userId, `🗑️ Olvidé *${entry.topic}*. Ya no usaré ese conocimiento.`, { simulateTyping: false });
        console.log(`[📚] Conocimiento eliminado por ${getDisplayId(userId)}: ${entry.file}`);
      } catch (e) {
        await sendWhatsAppMessage(userId, `❌ Error borrando: ${e.message}`, { simulateTyping: false });
      }
    }
    return;
  }

  // Comando /cancelar - salir de modo aprendizaje
  if (text.trim().toLowerCase() === '/cancelar') {
    if (learningMode.has(userId)) {
      learningMode.delete(userId);
      await sendWhatsAppMessage(userId, `❌ Cancelado. No guardé nada.`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `No estabas enseñándome nada.`, { simulateTyping: false });
    }
    return;
  }

  // ─── COMANDOS DE CONTABILIDAD ───
  const ingresoMatch = text.trim().match(/^\/(ingreso|entrada)\s+([\d,.]+)\s*(.*)?$/i);
  if (ingresoMatch) {
    const amount = parseFloat(ingresoMatch[2].replace(/,/g, ''));
    const desc = ingresoMatch[3]?.trim() || 'Ingreso registrado';
    const saved = await saveTransaction(userId, 'ingreso', amount, desc, 'general');
    if (saved) {
      await sendWhatsAppMessage(userId, `✅ Ingreso registrado:\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `⚠️ Ingreso anotado (modo local):\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}\n\n💡 Conecta PostgreSQL para persistencia.`, { simulateTyping: false });
    }
    return;
  }

  const gastoMatch = text.trim().match(/^\/(gasto|salida)\s+([\d,.]+)\s*(.*)?$/i);
  if (gastoMatch) {
    const amount = parseFloat(gastoMatch[2].replace(/,/g, ''));
    const desc = gastoMatch[3]?.trim() || 'Gasto registrado';
    const saved = await saveTransaction(userId, 'gasto', amount, desc, 'general');
    if (saved) {
      await sendWhatsAppMessage(userId, `✅ Gasto registrado:\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `⚠️ Gasto anotado (modo local):\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}\n\n💡 Conecta PostgreSQL para persistencia.`, { simulateTyping: false });
    }
    return;
  }

  if (text.trim().toLowerCase() === '/balance') {
    const bal = await getBalance(userId);
    if (bal) {
      const neto = parseFloat(bal.ingresos) - parseFloat(bal.gastos);
      await sendWhatsAppMessage(userId, `📊 *Balance financiero*\n\n💰 Ingresos: $${parseFloat(bal.ingresos).toLocaleString('es-DO')}\n💸 Gastos: $${parseFloat(bal.gastos).toLocaleString('es-DO')}\n\n📈 Neto: $${neto.toLocaleString('es-DO')}`, { simulateTyping: false });
    } else {
      await sendWhatsAppMessage(userId, `📊 No hay transacciones registradas aún.\n\nUsa:\n• /ingreso 5000 Venta soldadura\n• /gasto 1500 Material\n• /balance`, { simulateTyping: false });
    }
    return;
  }

  // Comando humano
  if (text.trim().toLowerCase() === HUMAN_COMMAND.toLowerCase()) {
    humanMode.add(userId);
    await sendWhatsAppMessage(userId, '👨‍💼 Modo humano activado. Un agente te atenderá pronto. Escribe "/bot" para reactivarme.');
    if (ADMIN_WHATSAPP) {
      await sendWhatsAppMessage(ADMIN_WHATSAPP, `⚠️ ${name} (${getDisplayId(userId)}) solicitó atención humana.`, { simulateTyping: false });
    }
    return;
  }

  // Comando reactivar bot
  if (text.trim().toLowerCase() === '/bot') {
    humanMode.delete(userId);
    await sendWhatsAppMessage(userId, pickVariation(GREETING_VARIATIONS));
    return;
  }

  // Modo humano activo
  if (humanMode.has(userId)) {
    console.log(`[👤] ${name} en modo humano, ignorando.`);
    return;
  }

  // Rate limiting
  const now = Date.now();
  const lastMessage = rateLimits.get(userId) || 0;
  if (now - lastMessage < RATE_LIMIT_SECONDS * 1000) {
    console.log(`[⏳] Rate limit: ${getDisplayId(userId)}`);
    await sendSystemMessage(userId, '⏳ Dame un segundo, estoy procesando tu mensaje anterior.');
    return;
  }
  rateLimits.set(userId, now);

  // Detectar si es grupo o privado
  const isGroup = userId.endsWith('@g.us');
  analytics.uniqueUsers.add(userId);

  // Truncar mensaje
  const truncatedText = truncateText(text, MAX_MESSAGE_LENGTH);

  // Guardar en memoria
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  const history = conversations.get(userId);
  history.push({ role: 'user', content: truncatedText });
  if (history.length > MEMORY_MAX_MESSAGES * 2) {
    history.shift();
  }

  console.log(`[🧠] Procesando → ${name} (${getDisplayId(userId)})${isGroup ? ' [GRUPO]' : ''}: "${truncatedText.substring(0, 50)}..."`);

  // Construir mensajes para IA con contexto temporal actual
  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Santo_Domingo' });
  const timeStr = currentDate.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' });
  const timeContext = `Hoy es ${dateStr}. La hora actual es ${timeStr} (hora de República Dominicana).`;

  // Buscar conocimiento relevante para este mensaje (RAG v2: chunks + TF-IDF)
  const relevantKnowledge = findRelevantKnowledge(truncatedText, 2500);
  let knowledgeContext = '';
  let usedTopic = null;
  if (relevantKnowledge) {
    knowledgeContext = `\n\nCONOCIMIENTO ESPECIALIZADO:\n${relevantKnowledge}`;
    // Extraer topic del primer chunk para analytics
    const topicMatch = relevantKnowledge.match(/^\[([^\]]+)\]/);
    usedTopic = topicMatch ? topicMatch[1] : null;
    console.log(`[📚] Conocimiento aplicado${usedTopic ? `: ${usedTopic}` : ''} (${relevantKnowledge.length} chars)`);
  }

  // Disclaimer legal automático si se usa conocimiento de leyes
  let legalDisclaimer = '';
  if (usedTopic && usedTopic.toLowerCase().includes('ley')) {
    legalDisclaimer = '\n\n⚠️ IMPORTANTE: Eres un asistente de información general. NO eres abogado. La información legal proporcionada es orientativa y no reemplaza la asesoría profesional de un abogado titulado. Siempre recomienda consultar con un profesional del derecho para casos específicos.';
  }

  // Construir system prompt compacto para ahorrar tokens
  const systemContent = `${SYSTEM_PROMPT}${legalDisclaimer}\n\n${timeContext}\n\nFAQs:\n${FAQS_TEXT}${knowledgeContext}`.substring(0, 4000);
  const messages = [
    { role: 'system', content: systemContent }
  ];
  history.slice(-MEMORY_MAX_MESSAGES * 2).forEach(h => {
    messages.push({ role: h.role, content: h.content });
  });

  const aiResult = await askAI(messages);
  const reply = aiResult.reply;
  const provider = aiResult.provider;

  let finalReply = reply;
  let usedFallback = false;

  if (reply === null) {
    // Fallback local inteligente con variación + delay anti-ban
    usedFallback = true;
    console.log(`[🆘] Usando respuesta local de emergencia para ${getDisplayId(userId)}`);
    finalReply = generateLocalReply(truncatedText) || pickVariation(FALLBACK_VARIATIONS);
    // Delay realista: después de 15s de espera, no responder en 0ms
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
  }

  // Anti-ban: variación natural de "gracias" y "hola"
  const lowerReply = finalReply.toLowerCase();
  if (lowerReply.includes('gracias') && lowerReply.length < 60) {
    finalReply = pickVariation(THANKS_VARIATIONS);
  }

  // Guardar respuesta en memoria
  history.push({ role: 'assistant', content: finalReply });

  await sendWhatsAppMessage(userId, finalReply);
  console.log(`[📤] Enviado a ${getDisplayId(userId)}${usedFallback ? ' [MODO LOCAL]' : provider === 'cache' ? ' [CACHE]' : ''}\n`);

  // Guardar en base de datos (con fallback a JSON si no hay PostgreSQL)
  saveMessageToDb(userId, name, 'user', truncatedText, null, false, null);
  saveMessageToDb(userId, name, 'assistant', finalReply, provider, usedFallback, usedTopic);

  // Auto-clasificación de leads por intención
  const autoTags = autoClassifyLead(truncatedText);
  if (autoTags.length > 0 && dbEnabled) {
    for (const tag of autoTags) {
      await addContactTag(userId, tag);
    }
    console.log(`[🏷️] Auto-tags para ${getDisplayId(userId)}: ${autoTags.join(', ')}`);
  }

  // Trackear analytics
  trackMessage(isGroup ? 'group' : 'private', provider, usedFallback, usedTopic);
  if (dbEnabled) updateAnalyticsDaily(1, analytics.uniqueUsers.size, usedFallback ? 1 : 0);

  // Notificar admin si usamos fallback o si la IA menciona humano
  if (ADMIN_WHATSAPP) {
    if (usedFallback) {
      await sendWhatsAppMessage(ADMIN_WHATSAPP, `🆘 Fallback local activado para ${name} (${getDisplayId(userId)}). Todas las IAs están caídas.\nMensaje: ${truncatedText}`, { simulateTyping: false });
    }
    const lowerReplyCheck = finalReply.toLowerCase();
    if (lowerReplyCheck.includes('humano') || lowerReplyCheck.includes('agente')) {
      await sendWhatsAppMessage(ADMIN_WHATSAPP, `⚠️ ${name} (${getDisplayId(userId)}) necesita escalamiento.\nMensaje: ${truncatedText}`, { simulateTyping: false });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// COLA DE MENSAJES
// ═══════════════════════════════════════════════════════════════════

async function processQueue() {
  if (isProcessing || messageQueue.length === 0) return;
  isProcessing = true;

  const { userId, name, text } = messageQueue.shift();
  try {
    await processMessage(userId, name, text);
  } catch (err) {
    console.error('[!] Error procesando mensaje:', err.message);
  }

  isProcessing = false;
  if (messageQueue.length > 0) {
    setImmediate(processQueue);
  }
}

function enqueueMessage(userId, name, text) {
  messageQueue.push({ userId, name, text });
  processQueue();
}

// ═══════════════════════════════════════════════════════════════════
// WEBHOOK a n8n
// ═══════════════════════════════════════════════════════════════════

async function sendToN8N(payload) {
  if (!N8N_WEBHOOK_URL) return;
  try {
    const data = JSON.stringify(payload);
    const url = new URL(N8N_WEBHOOK_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 5000
    };

    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[→] n8n OK (${res.statusCode})`);
        }
      });
    });

    req.on('error', () => {});
    req.write(data);
    req.end();
  } catch (err) {}
}

// ═══════════════════════════════════════════════════════════════════
// WHATSAPP CONNECTION
// ═══════════════════════════════════════════════════════════════════

// Anti-ban: session rotation tracking
let sessionFailureLog = []; // { code, time }
let currentSessionDir = SESSION_DIR;

function rotateSession() {
  if (!SESSION_ROTATION_ENABLED) return false;
  const now = Date.now();
  const tenMinAgo = now - 600000;
  sessionFailureLog = sessionFailureLog.filter(f => f.time > tenMinAgo);
  const recent401s = sessionFailureLog.filter(f => f.code === 401 || f.code === 403 || f.code === DisconnectReason.loggedOut).length;
  if (recent401s >= 2) {
    console.log('[🔄] Demasiados fallos 401. Rotando sesión...');
    try {
      if (fs.existsSync(SESSION_DIR)) {
        const backupDir = `${SESSION_DIR}_old_${Date.now()}`;
        fs.renameSync(SESSION_DIR, backupDir);
        console.log(`[✅] Sesión rotada a ${backupDir}`);
        // Limpiar backups antiguos (mantener solo los últimos 3)
        const parent = path.dirname(SESSION_DIR);
        const baseName = path.basename(SESSION_DIR);
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
    sessionFailureLog = [];
    return true;
  }
  return false;
}

async function startBot() {
  if (isShuttingDown) return;

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false, // Anti-ban: no mostrar siempre "en línea"
    keepAliveIntervalMs: 30000,
    browser: ['Chrome (Linux)', '', ''], // Anti-ban: browser más genérico
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    shouldIgnoreJid: (jid) => {
      if (jid === 'status@broadcast') return true;
      if (jid.endsWith('@g.us')) return true;
      return false;
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodeData = qr;
      console.log('\n╔════════════════════════════════════════════════╗');
      console.log('║  ESCANEA ESTE QR CON TU WHATSAPP              ║');
      console.log('║  Ajustes > Dispositivos vinculados > Vincular ║');
      console.log('╚════════════════════════════════════════════════╝\n');
      qrcode.generate(qr, { small: false });

      const qrPath = path.join(__dirname, 'qr-code.png');
      QRCode.toFile(qrPath, qr, { width: 600, margin: 4 }, (err) => {
        if (!err) {
          console.log('[+] QR guardado como qr-code.png');
        }
      });
    }

    if (connection === 'close') {
      isConnected = false;
      qrCodeData = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log(`\n[!] Conexión cerrada. Código: ${statusCode}`);

      // Registrar fallo para session rotation
      if (statusCode === 401 || statusCode === 403 || statusCode === DisconnectReason.loggedOut) {
        sessionFailureLog.push({ code: statusCode || 0, time: Date.now() });
      }

      // Si la sesión es inválida (401, 403, loggedOut), borrar credenciales
      if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
        console.log('[!] Sesión inválida o cerrada. Borrando credenciales...');
        try {
          if (fs.existsSync(SESSION_DIR)) {
            // Railway: no se puede borrar el directorio raíz del volumen (EBUSY).
            // Borramos archivos individualmente.
            const entries = fs.readdirSync(SESSION_DIR);
            for (const entry of entries) {
              const fullPath = path.join(SESSION_DIR, entry);
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
        // Anti-ban: intentar rotar sesión antes de reiniciar
        rotateSession();
        if (ADMIN_WHATSAPP) {
          sendWhatsAppMessage(ADMIN_WHATSAPP, '⚠️ Sesión borrada. Escanea QR nuevo en: https://necio-whatsapp-bot-v3-production.up.railway.app/qr', { simulateTyping: false })
            .catch(() => {});
        }
        if (!isShuttingDown) {
          const delay = NODE_ENV === 'production' ? 15000 + Math.floor(Math.random() * 10000) : 5000;
          console.log(`[+] Reiniciando en ${delay / 1000}s para generar QR...\n`);
          setTimeout(startBot, delay);
        }
      } else if (!isShuttingDown) {
        const delay = NODE_ENV === 'production' ? 10000 + Math.floor(Math.random() * 5000) : 5000;
        console.log(`[+] Reconectando en ${delay / 1000}s...\n`);
        setTimeout(startBot, delay);
      }
    }

    if (connection === 'open') {
      isConnected = true;
      qrCodeData = null;
      botPhoneNumber = sock.user?.id?.split(':')[0];
      console.log('\n✅ BOT CONECTADO Y LISTO');
      console.log('📱 Número:', botPhoneNumber);
      console.log('🌐 API HTTP: http://' + HOST + ':' + PORT);
      console.log('⏳ Esperando mensajes...\n');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
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

      sendToN8N({
        from: getDisplayId(sender),
        name: pushName,
        body: text,
        timestamp,
        chatId: sender,
        messageId: msg.key.id
      });

      enqueueMessage(sender, pushName, text);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Cerrando bot gracefulmente...`);
  isShuttingDown = true;
  saveConversations();

  if (sock) {
    try {
      await sock.logout();
    } catch (e) {}
    sock = null;
  }

  console.log('[✅] Bot detenido. Hasta luego!');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ═══════════════════════════════════════════════════════════════════
// INICIO
// ═══════════════════════════════════════════════════════════════════

// Reset de sesión si se solicita (para vincular nuevo número)
if (process.env.RESET_SESSION === 'true') {
  console.log('[🗑️] RESET_SESSION activado. Borrando sesión anterior...');
  if (fs.existsSync(SESSION_DIR)) {
    try {
      // Borrar archivos individualmente (más compatible con volúmenes Docker)
      const files = fs.readdirSync(SESSION_DIR);
      for (const file of files) {
        try {
          fs.rmSync(path.join(SESSION_DIR, file), { recursive: true, force: true });
        } catch (e) {
          // ignorar archivos que no se puedan borrar
        }
      }
      console.log('[✅] Sesión anterior eliminada.');
    } catch (e) {
      console.error('[!] Error borrando sesión:', e.message);
    }
  }
}

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}
if (!fs.existsSync(path.join(__dirname, 'config'))) {
  fs.mkdirSync(path.join(__dirname, 'config'), { recursive: true });
}
if (!fs.existsSync(path.join(__dirname, 'memory'))) {
  fs.mkdirSync(path.join(__dirname, 'memory'), { recursive: true });
}

loadConversations();
loadKnowledge();

app.listen(PORT, HOST, () => {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     🤖 THE NECIO - BOT WHATSAPP v3.0             ║');
  console.log('║     Multi-IA · Fallback Infinito · 24/7          ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  API HTTP:  http://${HOST}:${PORT}                 ║`);
  console.log(`║  IAs:       Groq → Gemini → OpenRouter → Mistral ║`);
  console.log(`║  Fallback:  Respuesta local inteligente          ║`);
  console.log(`║  Memoria:   ${PERSIST_MEMORY ? 'PERSISTENTE' : 'VOLATIL'.padEnd(35)} ║`);
  console.log('╚══════════════════════════════════════════════════╝\n');
});

startBot().catch((err) => {
  console.error('[!] Error fatal iniciando bot:', err);
  process.exit(1);
});
