# Plan Super Bot Necio — Más inteligente, humano y configurable sin deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el bot en un asistente que responda como un humano dominicano natural, aprenda de cada conversación, y permita activar/desactivar funciones desde una web sin necesidad de redeployar ni escanear QR.

**Architecture:** Se añade una capa de `features` persistente en volumen (`config/features.json` + `config/personality.json`) que se recarga en caliente. El `processor` consulta estas flags antes de ejecutar cada módulo. Un dashboard web (`/admin`) permite toggles, edición de personalidad, monitoreo y manejo de plugins. Los módulos actuales (finanzas, CRM, aprendizaje) se convierten en plugins desactivables.

**Tech Stack:** Node.js + Express + Baileys (existente). Sin frameworks frontend pesados: HTML/CSS/JS vanilla en `src/admin/`. Persistencia en volumen de Fly.io (`config/`, `memory/`, `knowledge/`).

---

## Fase 0: Sistema de features configurable en caliente (base obligatoria)

**Objetivo:** Permitir encender/apagar funciones del bot editando un archivo JSON o llamando a un endpoint, sin reiniciar el proceso.

**Files:**
- Create: `src/features/index.js`
- Create: `config/features.json`
- Modify: `src/processor/index.js` (consultar features antes de cada módulo)
- Modify: `src/index.js` (inyectar `features` en deps)
- Modify: `src/web/routes.js` (endpoints para leer/escribir features)

### Task 0.1: Crear `config/features.json` por defecto

- [ ] **Step 1: Escribir el archivo de features por defecto**

```json
{
  "version": "1.0.0",
  "updatedAt": "",
  "modules": {
    "greeting": { "enabled": true, "description": "Saludos y despedidas automáticas" },
    "emotionDetection": { "enabled": true, "description": "Detecta emociones y adapta el tono" },
    "knowledgeRag": { "enabled": true, "description": "Usa archivos de conocimiento cargados" },
    "crm": { "enabled": true, "description": "Comandos /cliente, /estado, /etiqueta, /miinfo" },
    "finance": { "enabled": true, "description": "Comandos /ingreso, /gasto, /balance" },
    "learning": { "enabled": true, "description": "Comandos /aprender, /temas, /olvidar" },
    "humanMode": { "enabled": true, "description": "Comando /humano para escalar" },
    "analytics": { "enabled": true, "description": "Estadísticas y seguimiento" },
    "antiBan": { "enabled": true, "description": "Protección anti-flood y anti-spam" },
    "typingSimulation": { "enabled": true, "description": "Simula que está escribiendo" }
  },
  "ai": {
    "primaryProvider": "pollinations",
    "fallbackProviders": ["groq", "gemini", "openrouter", "mistral"],
    "temperature": 0.7,
    "maxTokens": 250,
    "useCache": true,
    "timeoutMs": 15000
  },
  "personality": {
    "tone": "amigo_dominicano",
    "useEmojis": true,
    "maxEmojisPerMessage": 2,
    "useLocalSlang": true,
    "autoFollowUp": false,
    "followUpDelayMinutes": 30
  }
}
```

### Task 0.2: Crear módulo `src/features/index.js`

- [ ] **Step 2: Implementar carga y recarga en caliente**

```javascript
const fs = require('fs');
const path = require('path');

function createFeatures(config, context, deps) {
  const featuresPath = path.join(config.rootDir, 'config', 'features.json');
  let features = loadFeatures();

  function loadFeatures() {
    try {
      if (fs.existsSync(featuresPath)) {
        return JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
      }
    } catch (e) {
      console.error('[!] Error cargando features:', e.message);
    }
    return getDefaultFeatures();
  }

  function saveFeatures(data) {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(featuresPath, JSON.stringify(data, null, 2), 'utf8');
    features = data;
    console.log('[✅] Features actualizadas:', featuresPath);
    return features;
  }

  function reloadFeatures() {
    features = loadFeatures();
    return features;
  }

  function isEnabled(moduleName) {
    return !!features.modules[moduleName]?.enabled;
  }

  function getAI() {
    return features.ai;
  }

  function getPersonality() {
    return features.personality;
  }

  function getAll() {
    return features;
  }

  function updateFeatures(patch) {
    const merged = { ...features, ...patch };
    return saveFeatures(merged);
  }

  return {
    loadFeatures,
    saveFeatures,
    reloadFeatures,
    isEnabled,
    getAI,
    getPersonality,
    getAll,
    updateFeatures,
  };
}

function getDefaultFeatures() {
  return { /* ... contenido del Task 0.1 ... */ };
}

module.exports = createFeatures;
```

### Task 0.3: Inyectar features en el sistema

- [ ] **Step 3: Modificar `src/index.js` para registrar `features` en deps**

```javascript
const createFeatures = require('./features');
// ... después de crear deps
const features = createFeatures(config, context, deps);
deps.features = features;
deps.isEnabled = features.isEnabled;
deps.getAI = features.getAI;
deps.getPersonality = features.getPersonality;
deps.reloadFeatures = features.reloadFeatures;
```

### Task 0.4: Proteger módulos existentes con feature flags

- [ ] **Step 4: Modificar `src/processor/index.js` para consultar `deps.isEnabled()`**

Ejemplos de guards a agregar:
- Anti-ban solo si `deps.isEnabled('antiBan')`.
- Comando `/humano` solo si `deps.isEnabled('humanMode')`.
- Comandos CRM solo si `deps.isEnabled('crm')`.
- Comandos finanzas solo si `deps.isEnabled('finance')`.
- Aprendizaje solo si `deps.isEnabled('learning')`.
- Saludos/despedidas solo si `deps.isEnabled('greeting')`.
- Emoción solo si `deps.isEnabled('emotionDetection')`.
- RAG solo si `deps.isEnabled('knowledgeRag')`.
- Typing simulation solo si `deps.isEnabled('typingSimulation')`.

### Task 0.5: Endpoints para control remoto

- [ ] **Step 5: Agregar en `src/web/routes.js`**

```javascript
app.get('/api/features', requireAuth, (req, res) => {
  res.json(deps.getAll());
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
  res.json({ success: true, features: deps.reloadFeatures() });
});
```

**Verification:**
- [ ] `curl -H "X-API-Key: <secret>" https://<host>/api/features` devuelve JSON.
- [ ] Cambiar `modules.finance.enabled` a `false` y llamar `/api/features/reload` hace que `/balance` responda "comando no disponible".
- [ ] No se requiere reinicio del servidor.

---

## Fase 1: Super personalidad humana

**Objetivo:** Que el bot suene como un amigo dominicano real, con memoria emocional, contexto conversacional y respuestas que no se repitan.

**Files:**
- Create: `src/personality/index.js`
- Create: `config/personality.json`
- Modify: `src/config/prompts.js` (cargar personalidad dinámica)
- Modify: `src/brain/index.js` (más variaciones y memoria emocional)
- Modify: `src/processor/index.js` (usar personalidad y memoria)

### Task 1.1: Configuración de personalidad editable

- [ ] **Step 1: Crear `config/personality.json`**

```json
{
  "name": "Necio",
  "fullName": "NecioBot",
  "identity": "Asistente virtual oficial de The Necio Digital. Dominicano de corazón.",
  "tone": "amigo_cercano",
  "slang": ["dime", "vamos allá", "claro que sí", "dame un segundito", "mira eso", "fuego", "qué lo que", "dale", "tranqui"],
  "forbiddenPhrases": [
    "Como asistente virtual no puedo",
    "No tengo la capacidad de",
    "Mi programación no me permite",
    "Lo siento, no entendí"
  ],
  "emotionMemory": true,
  "greetByName": true,
  "rememberLastTopic": true,
  "maxMessageLength": 600,
  "humanLikeDelays": true
}
```

### Task 1.2: Motor de personalidad

- [ ] **Step 2: Crear `src/personality/index.js`**

Responsabilidades:
- Cargar `config/personality.json`.
- Generar prefijos emocionales más ricos (alegría, tristeza, urgencia, escepticismo).
- Construir el system prompt final combinando `config/prompts.js` + personalidad + features.
- Proveer `buildSystemPrompt(context, userId)`.

```javascript
function buildSystemPrompt({ userId, currentDate, timeContext, knowledgeContext, emotionContext, features }) {
  const personality = getPersonality();
  const lines = [];
  lines.push(`Eres ${personality.name}, ${personality.identity}`);
  lines.push(`Tono: ${personality.tone}. Usa "tú". ${personality.slang.join(', ')}.`);
  lines.push('REGLAS DE CONVERSACIÓN CON PERSONAS REALES:');
  lines.push('1. Saluda como un humano. Nunca digas "soy un asistente virtual".');
  lines.push('2. Usa emojis con moderación (máx 2 por mensaje).');
  lines.push('3. Si la pregunta es ambigua, pregunta de vuelta en lugar de adivinar.');
  lines.push('4. Valida emociones antes de resolver.');
  lines.push('5. Nunca uses frases robóticas.');
  lines.push('6. Mantén contexto de la conversación actual.');
  lines.push('7. Si alguien escribe solo "hola", responde con calidez y propón ayuda.');
  lines.push('8. Varía tus respuestas. NUNCA repitas la misma frase exacta.');
  lines.push('9. Si no sabes algo, admítelo con naturalidad y ofrece buscar ayuda.');
  lines.push('10. Sé conciso: máximo 3 oraciones cortas salvo que te pidan detalle.');
  if (features.isEnabled('knowledgeRag') && knowledgeContext) {
    lines.push(`CONOCIMIENTO ESPECIALIZADO:\n${knowledgeContext}`);
  }
  lines.push(emotionContext);
  lines.push(timeContext);
  return lines.filter(Boolean).join('\n\n').substring(0, 4000);
}
```

### Task 1.3: Ampliar variaciones en `src/brain/index.js`

- [ ] **Step 3: Añadir 20+ variaciones por categoría**

```javascript
const GREETING_VARIATIONS = [
  '¿Qué lo que! 👋 ¿En qué te puedo echar una mano hoy?',
  '¡Buenas! ¿Cómo va todo? Dime qué necesitas.',
  'Hey, hey 👋 ¿Qué hay? Cuéntame.',
  '¿Qué tal? Aquí estoy. ¿En qué te ayudo?',
  '¡Saludos! ¿Qué vamos a resolver hoy?',
  'Dime, dime. ¿Qué necesitas?',
  '¿Cómo estamos? Cuéntame.',
  'Aquí al frente. ¿Qué lo que?',
  '¡Fuego! Dime qué vamos a hacer.',
  '¿Todo bien? Estoy ready.',
];
```

Añadir también variaciones para:
- `CONFUSED_VARIATIONS`
- `BUSY_VARIATIONS`
- `FALLBACK_VARIATIONS`
- `UNKNOWN_ANSWER_VARIATIONS`

### Task 1.4: Memoria conversacional simple

- [ ] **Step 4: En `src/processor/index.js`, guardar resumen del último tema**

```javascript
// Después de cada respuesta de IA
if (reply && usedTopic) {
  rememberPreference(context, userId, 'lastTopic', usedTopic);
}

// Al inicio del mensaje, si hay silencio > 30 min y lastTopic
const lastActive = context.lastActiveTime?.get(userId) || 0;
if (Date.now() - lastActive > 30 * 60 * 1000 && getPreference(context, userId, 'lastTopic')) {
  // El system prompt puede incluir: "La última vez hablaron de X"
}
context.lastActiveTime = context.lastActiveTime || new Map();
context.lastActiveTime.set(userId, Date.now());
```

**Verification:**
- [ ] Editar `config/personality.json` y recargar cambia el tono del bot inmediatamente.
- [ ] Dos saludos seguidos no devuelven la misma frase.
- [ ] El fallback suena humano, no robótico.

---

## Fase 2: Inteligencia potenciada

**Objetivo:** Mejorar la calidad de respuestas con mejor IA, mejor búsqueda de conocimiento y memoria a largo plazo.

**Files:**
- Create: `src/ai/providers/cerebras.js` (ya existe; verificar y mejorar)
- Create: `src/ai/memory.js`
- Modify: `src/ai/dispatcher.js` (usar configuración de features)
- Modify: `src/rag/index.js` (mejorar chunking)
- Modify: `src/processor/index.js` (usar memoria)

### Task 2.1: Configurar Cerebras como opción principal

- [ ] **Step 1: Asegurar `src/ai/providers/cerebras.js` funcional**

El archivo ya existe. Verificar que use el modelo por defecto correcto (`llama-3.3-70b` o `llama-4-scout` según disponibilidad). Actualizar default en `src/config/index.js`:

```javascript
cerebrasModel: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
```

### Task 2.2: Dispatcher con configuración dinámica

- [ ] **Step 2: Modificar `src/ai/dispatcher.js` para leer orden de providers de features**

```javascript
const aiConfig = deps.getAI();
const allProviders = [
  { name: 'cerebras', fn: deps.askCerebras, available: !!config.cerebrasApiKey },
  { name: 'groq', fn: deps.askGroq, available: !!config.groqApiKey },
  { name: 'gemini', fn: deps.askGemini, available: !!config.geminiApiKey },
  { name: 'openrouter', fn: deps.askOpenRouter, available: !!config.openRouterApiKey },
  { name: 'together', fn: deps.askTogether, available: !!config.togetherApiKey },
  { name: 'github', fn: deps.askGitHubModels, available: !!config.githubModelsToken },
  { name: 'mistral', fn: deps.askMistral, available: !!config.mistralApiKey },
  { name: 'pollinations', fn: deps.askPollinations, available: true },
];

const orderedNames = [aiConfig.primaryProvider, ...(aiConfig.fallbackProviders || [])].filter(Boolean);
const providers = orderedNames
  .map(name => allProviders.find(p => p.name === name))
  .filter(p => p && p.available);
```

### Task 2.3: Memoria a largo plazo

- [ ] **Step 3: Crear `src/ai/memory.js`**

```javascript
function createMemory(config, context) {
  function getUserMemory(userId) {
    return context.conversations.get(userId) || [];
  }

  function addMessage(userId, role, content) {
    if (!context.conversations.has(userId)) context.conversations.set(userId, []);
    const history = context.conversations.get(userId);
    history.push({ role, content, ts: Date.now() });
    const max = config.memoryMaxMessages * 2;
    if (history.length > max) history.shift();
  }

  function getSummary(userId) {
    const history = getUserMemory(userId);
    if (history.length < 4) return null;
    const topics = {};
    for (const h of history) {
      if (h.role === 'user') {
        // TF-IDF simple o keyword extraction
        const words = h.content.toLowerCase().split(/\W+/).filter(w => w.length > 4);
        for (const w of words) topics[w] = (topics[w] || 0) + 1;
      }
    }
    const top = Object.entries(topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w);
    return top.length ? `Temas recurrentes: ${top.join(', ')}.` : null;
  }

  return { getUserMemory, addMessage, getSummary };
}

module.exports = createMemory;
```

### Task 2.4: Mejorar RAG

- [ ] **Step 4: Revisar `src/rag/index.js` y mejorar chunking**

Asegurar que:
- Los chunks no corten oraciones a mitad.
- Se indexe por keywords + título.
- Se limite a los 2 chunks más relevantes.
- Se recargue en caliente con `/reload-knowledge`.

**Verification:**
- [ ] Probar con Cerebras (si hay API key) y ver que responde más rápido.
- [ ] Sin API keys, Pollinations sigue funcionando como fallback.
- [ ] Subir un tema nuevo y preguntar sobre él devuelve info del RAG.

---

## Fase 3: Dashboard de control web (`/admin`)

**Objetivo:** Una interfaz visual para encender/apagar funciones, editar personalidad, ver estadísticas y gestionar QR/sesión.

**Files:**
- Create: `src/admin/dashboard.html` (template completo)
- Create: `src/admin/admin.js` (frontend logic)
- Create: `src/admin/styles.css`
- Modify: `src/web/pages.js` (servir dashboard)
- Modify: `src/web/routes.js` (endpoints para admin)

### Task 3.1: Diseño del dashboard

**Design Specification:**

- **Aesthetic Direction**: Cyberpunk/utilitario dominicano — oscuro, acentos neón verde/cyan, monoespaciado para datos.
- **Tone**: Panel de control de un bot que "nunca duerme".
- **Display font**: `Bebas Neue` (fallback: Impact)
- **Body font**: `Space Mono` (fallback: monospace)
- **CSS variables**:
  - `--bg: #0a0a0f`
  - `--panel: #12121a`
  - `--text: #e0e0e0`
  - `--muted: #888`
  - `--accent: #00ff88`
  - `--accent-2: #00d4ff`
  - `--danger: #ff3366`
- **Motion**: CSS-only. Toggle switches con transición 0.2s, cards con hover lift.
- **Layout**: Sidebar + grid de cards. Responsive a una columna en móvil.

### Task 3.2: Template HTML del dashboard

- [ ] **Step 1: Crear `src/admin/dashboard.html`**

Secciones:
- Header con estado de conexión (verde/rojo), uptime, memoria.
- Card "Features": switches para cada módulo.
- Card "Personalidad": textarea para editar reglas, sliders para emojis/temperatura.
- Card "IA": selector de provider principal, lista de fallback, temperatura.
- Card "Conocimiento": lista de temas + botón recargar + subir archivo.
- Card "Estadísticas": mensajes, usuarios, fallbacks, proveedores usados.
- Card "Sesión": botón "Forzar reconexión" (con confirmación) + link a QR.

### Task 3.3: Frontend JS

- [ ] **Step 2: Crear `src/admin/admin.js`**

Funciones:
- `loadFeatures()`: GET `/api/features`.
- `saveFeatures(features)`: POST `/api/features`.
- `renderFeatures(features)`: crear switches.
- `renderStats()`: GET `/stats`.
- `updateProviderOrder()`: drag-and-drop simple o selectores.
- `reloadKnowledge()`: POST `/reload-knowledge`.
- `confirmReconnect()`: POST `/api/session/reconnect`.

### Task 3.4: Rutas del admin

- [ ] **Step 3: Modificar `src/web/routes.js`**

```javascript
app.get('/admin', (req, res) => {
  res.send(pages.adminPage());
});

app.get('/admin/*', (req, res) => {
  res.send(pages.adminPage());
});

app.post('/api/session/reconnect', requireAuth, async (req, res) => {
  try {
    if (context.sock) {
      context.sock.ev.removeAllListeners();
      context.sock = null;
    }
    context.reconnectAttempts = 0;
    setTimeout(() => deps.startBot().catch(() => {}), 2000);
    res.json({ success: true, message: 'Reconexión iniciada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

**Verification:**
- [ ] Abrir `/admin` muestra el panel.
- [ ] Apagar "finance" desde el switch y guardar desactiva `/balance`.
- [ ] El botón "Forzar reconexión" no borra la sesión (no requiere QR nuevo a menos que sea logout).

---

## Fase 4: Módulos dinámicos (plugins)

**Objetivo:** Permitir agregar nuevas habilidades al bot subiendo archivos a una carpeta, sin redeployar.

**Files:**
- Create: `src/plugins/index.js`
- Create: `plugins/.gitkeep`
- Modify: `src/processor/index.js` (delegar comandos a plugins)
- Modify: `src/web/routes.js` (subir/activar/desactivar plugins)

### Task 4.1: Sistema de plugins simple

- [ ] **Step 1: Crear `src/plugins/index.js`**

Cada plugin es un archivo JS con:

```javascript
module.exports = {
  name: 'recordatorios',
  description: 'Recordatorios simples',
  commands: ['recordatorio', 'recordar'],
  enabled: true,
  handler: async ({ userId, text, args, deps, context }) => {
    // lógica del plugin
    return 'Recordatorio guardado.';
  }
};
```

El loader:
- Lee todos los archivos de `plugins/`.
- Filtra los habilitados según `features.json`.
- Expone `dispatchCommand(command, payload)`.

### Task 4.2: Integrar plugins en el processor

- [ ] **Step 2: En `src/processor/index.js`, antes de delegar a IA**, intentar match de plugin:

```javascript
const pluginResult = await deps.dispatchCommand(text, { userId, name, context });
if (pluginResult) {
  await deps.sendWhatsAppMessage(userId, pluginResult);
  return;
}
```

### Task 4.3: Gestión desde dashboard

- [ ] **Step 3: Añadir endpoints para plugins**

```javascript
app.get('/api/plugins', requireAuth, (req, res) => {
  res.json(deps.listPlugins());
});

app.post('/api/plugins/:name/toggle', requireAuth, (req, res) => {
  const updated = deps.togglePlugin(req.params.name, req.body.enabled);
  res.json({ success: true, plugin: updated });
});
```

**Verification:**
- [ ] Crear un plugin de prueba en `plugins/test.js` y recargar.
- [ ] Enviar el comando del plugin por WhatsApp funciona.
- [ ] Desactivarlo desde dashboard y el comando ya no responde.

---

## Fase 5: Verificación y deploy sin perder sesión

**Objetivo:** Subir cambios a Fly.io sin borrar la sesión de WhatsApp.

### Task 5.1: Preparar deploy seguro

- [ ] **Step 1: Asegurar que el volumen persista `auth_info_baileys`**

El `fly.toml` ya debe montar el volumen en `/app/auth_info_baileys`. Verificar:

```toml
[mounts]
source = "necio_whatsapp_data"
destination = "/app/auth_info_baileys"
```

Si el volumen se monta en `/app/auth_info_baileys`, la sesión sobrevive al deploy.

### Task 5.2: Deploy por fases

- [ ] **Step 2: Deployar con `flyctl deploy`**

```bash
flyctl deploy --app necio-whatsapp-bot-v3 --ha=false
```

### Task 5.3: Verificación post-deploy

- [ ] **Step 3: Verificar `/health`**

```bash
curl -s https://necio-whatsapp-bot-v3.fly.dev/health | python -m json.tool
```

Esperar `connected: true`.
- [ ] **Step 4: Verificar `/admin`**
- [ ] **Step 5: Probar toggle de feature**
- [ ] **Step 6: Enviar mensaje de prueba por WhatsApp**

---

## Anti-pattern guards

- NO inventar APIs de Baileys que no existan.
- NO hardcodear API keys en el frontend.
- NO guardar secrets en `config/features.json`.
- NO borrar `auth_info_baileys` durante el deploy.
- NO reiniciar el proceso cuando un feature cambia; usar recarga en caliente.
- NO convertir a ESM; mantener CommonJS.

---

## Execution Handoff

**Plan saved to:** `docs/plan-super-bot.md`

**Recommended execution:** Subagent-Driven Development — un subagente por fase, con revisión entre cada una.

**Priority:** Fase 0 y Fase 1 primero (base + personalidad). Luego Fase 3 (dashboard). Fase 2 y 4 pueden ir en paralelo.
