# Plan de Refactorización Modular - Necio WhatsApp Bot

## Objetivo
Convertir el monolito `index.js` (2975 líneas) + `necio-brain.js` en una arquitectura modular bajo `src/`, manteniendo la misma lógica y comportamiento externo.

## Restricciones
- Usar CommonJS (type: commonjs en package.json).
- No cambiar APIs externas ni lógica de negocio.
- No convertir a ESM.
- No romper el entry point actual hasta que el nuevo esté listo.
- Mantiene variables de entorno existentes.

## Estructura de carpetas
```
src/
  config/index.js        # Variables de entorno y constantes
  utils/
    helpers.js           # Funciones puras: getDisplayId, isValidUserJid, truncateText, normalizeForFingerprint, pickVariation
    files.js             # mkdirIfNeeded, safeWrite, safeReadJSON
    http.js              # httpRequest genérico
    documents.js         # parseDocument (PDF, DOCX, XLSX)
  state/index.js         # Contexto global singleton: sock, isConnected, conversations, analytics, circuitBreakers, etc.
  cache/index.js         # Response cache: getCacheKey, getCachedReply, setCachedReply
  anti-ban/index.js      # isFlood, recordMessage, isSpam, isAggressivePattern, load/save blocked users
  brain/index.js         # Emociones, small talk, saludos, variaciones, preferences, clarification
  rag/index.js           # Carga de conocimiento, TF-IDF, findRelevantKnowledge
  db/index.js            # Supabase init y funciones de DB
  ai/
    providers/           # Un archivo por provider: groq, gemini, openrouter, mistral, cerebras, together, github
    circuit-breaker.js   # isCircuitOpen, recordFailure, recordSuccess, getCircuitStatus
    dispatcher.js        # askAI con fallback infinito
    fallback.js          # generateLocalReply
  whatsapp/
    connection.js        # startBot, handlers de Baileys, QR, session rotation
    sender.js            # sendWhatsAppMessage, typing simulation
  queue/index.js         # processQueue, enqueueMessage
  processor/index.js     # processMessage, comandos, IA, analytics
  n8n/index.js           # sendToN8N
  keepalive/index.js     # startKeepAlive, watchdog
  web/
    index.js             # Crear app Express, middleware, multer
    routes.js            # Definición de rutas
    pages.js             # HTML strings (/qr, /qr-html, /learn)
  index.js               # Entry point: inicializa config, state, db, rag, ai, whatsapp, queue, web, keepalive, shutdown
```

## Patrón de inyección de dependencias
- `src/state/index.js` exporta un objeto `context` singleton.
- Los módulos exportan funciones que reciben `(context, deps)` o usan `context` directamente.
- `deps` es un objeto con funciones cruzadas para evitar ciclos:
  - `deps.sendWhatsAppMessage`
  - `deps.processMessage`
  - `deps.askAI`
  - `deps.findRelevantKnowledge`
  - etc.

## Pasos de implementación
1. Crear directorios.
2. Copiar `index.js` a `index.js.backup` y `necio-brain.js` a `necio-brain.js.backup` por seguridad.
3. Escribir `src/config/index.js`.
4. Escribir `src/utils/helpers.js`, `src/utils/files.js`, `src/utils/http.js`, `src/utils/documents.js`.
5. Escribir `src/state/index.js`.
6. Escribir `src/cache/index.js`.
7. Escribir `src/anti-ban/index.js`.
8. Escribir `src/brain/index.js`.
9. Escribir `src/rag/index.js`.
10. Escribir `src/db/index.js`.
11. Escribir `src/ai/providers/*.js` y `src/ai/{circuit-breaker,dispatcher,fallback}.js`.
12. Escribir `src/whatsapp/sender.js` y `src/whatsapp/connection.js`.
13. Escribir `src/queue/index.js`.
14. Escribir `src/processor/index.js`.
15. Escribir `src/n8n/index.js`.
16. Escribir `src/keepalive/index.js`.
17. Escribir `src/web/{index.js,routes.js,pages.js}`.
18. Reescribir `src/index.js` como entry point.
19. Actualizar `package.json`: main = src/index.js, scripts start/dev/test.
20. Crear tests básicos en `tests/`.
21. Verificar sintaxis con `node --check src/index.js`.
22. Ejecutar `npm test`.
23. Ejecutar `npm start` y verificar que el servidor levante (sin errores de sintaxis; no requiere WA conectado).

## Notas de portado
- Mantener SYSTEM_PROMPT literalmente igual.
- Mantener FAQs load igual.
- Mantener rutas y respuestas HTTP iguales.
- Mantener comportamiento de anti-ban.
- Mantener orden de providers en askAI.
- Mantener analytics como objeto con Sets y Maps.
- ` necio-brain.js` quedará obsoleto; su lógica ya no se usa desde index.js actualmente (es un módulo separado). Se puede eliminar o dejar como legacy.

## Verificación
- `node --check src/index.js`
- `npm test`
- `timeout 10 npm start` debe iniciar sin errores y mostrar banner.
