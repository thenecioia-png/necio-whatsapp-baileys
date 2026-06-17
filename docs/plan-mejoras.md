# 🔒 Plan de Mejoras — Necio WhatsApp Bot v3

> **Repo:** `necio-whatsapp-baileys-code`  
> **Bot activo:** Sí, responde al número `8297837862` / `18297837862`  
> **Deploy:** Fly.io → `https://necio-whatsapp-bot-v3.fly.dev`  
> **Fecha de revisión:** 2026-06-17

---

## ✅ Confirmación

Este **SÍ** es el bot que funciona con tu número `8297837862`. Lo confirmé porque:
- El archivo `.env.example` y la documentación interna (`BOT_ACTIVO_PRINCIPAL.md`) apuntan a `ADMIN_WHATSAPP=18297837862`.
- El repo está desplegado en `necio-whatsapp-bot-v3.fly.dev`.
- Los otros repositorios (`whatsapp-bot-review`, `the-necio-whatsapp-bot`, `necio-bot-wwebjs`) están inactivos o usan otra tecnología.

---

## 🚨 URGENTE: Acciones que debes tomar HOY

### 1. Rotar API keys de IA (Groq y Gemini)

Encontré **tres API keys hardcodeadas** en el código fuente. Aunque ya las eliminé del código, **podrían haber quedado expuestas en el historial de Git** o en la imagen Docker anterior.

- **Groq (index.js):** `[GROQ_KEY_ELIMINADA]`
- **Gemini (index.js):** `[GEMINI_KEY_ELIMINADA]`
- **Groq (necio-brain.js):** `[GROQ_KEY_ELIMINADA]`

**Qué hacer:**
1. Ve a https://console.groq.com/keys → elimina esas keys y crea nuevas.
2. Ve a https://aistudio.google.com/app/apikey → elimina esa key y crea una nueva.
3. Actualiza las variables `GROQ_API_KEY` y `GEMINI_API_KEY` en tu `.env` de Fly.io.
4. Re-despliega.

### 2. Cambiar API_SECRET

El fallback anterior era `neciobot2026seguro` y aparecía en documentación.  
**Qué hacer:** Genera una contraseña larga y aleatoria (mínimo 32 caracteres) y configúrala como `API_SECRET` en Fly.io. Los endpoints `/send`, `/learn`, `/qr`, `/keep-alive` ahora la exigen.

### 3. Revocar y regenerar la sesión de WhatsApp

Encontré backups de credenciales de WhatsApp (`auth_info_baileys_backup_20260516_001753/` y `auth_backup.tar.gz`) en el disco. Las eliminé, pero **si alguna vez fueron subidas a Git, están comprometidas**.

**Qué hacer:**
1. En tu teléfono: WhatsApp → Ajustes → Dispositivos vinculados → cerrar la sesión del bot.
2. Borrar la carpeta `auth_info_baileys` en Fly.io (o reiniciar con `RESET_SESSION=true` una vez).
3. Escanear el QR nuevo desde `/qr-html`.

### 4. Limpiar historial de Git (si las keys o credenciales llegaron a subirse)

Si en algún commit subiste `.env`, keys o backups de sesión, el historial de Git las conserva.

**Opción recomendada:** Crear un repositorio nuevo en GitHub y dejar de usar el actual como fuente de deploy.  
**Opción avanzada:** Usar `git filter-repo` o BFG Repo-Cleaner para borrar del historial. Puedo ayudarte con esto si me confirmas que las keys llegaron a Git.

---

## ✅ Correcciones aplicadas hoy

| Problema | Archivo(s) | Cambio |
|----------|-----------|--------|
| API keys hardcodeadas | `index.js`, `necio-brain.js` | Eliminadas; ahora solo se leen de `.env` |
| `requireAuth` permitía acceso sin `API_SECRET` | `index.js` | Ahora falla cerrado (HTTP 503) si falta la key |
| Endpoints sensibles abiertos | `index.js` | `/learn`, `/qr`, `/qr-html`, `/keep-alive`, `/send` ahora requieren `API_SECRET` |
| API key expuesta en HTML de `/learn` | `index.js` | Ya no se incrusta; el navegador pide la key vía prompt |
| Cualquier usuario era admin si `ADMIN_WHATSAPP` estaba vacío | `index.js` | Nueva función `isAdminUser()` con comparación exacta |
| Backups de sesión de WhatsApp en disco | `auth_info_baileys_backup_*`, `auth_backup.tar.gz` | Eliminados |
| Dockerfile copiaba credenciales | `Dockerfile`, `.dockerignore` | Eliminada la copia de backups; `.dockerignore` más estricto |
| Graceful shutdown borraba sesión | `index.js` | Ya no hace `logout()`; limpia timers y guarda conversaciones |
| Cola de mensajes podía quedar bloqueada | `index.js` | `isProcessing` ahora se resetea en `finally` |
| Sin manejo de errores no atrapados | `index.js` | Agregados handlers de `unhandledRejection` y `uncaughtException` |
| Body parser sin límite | `index.js` | Límite de 100 KB |
| Sin headers de seguridad | `index.js` | Instalado y configurado `helmet` |
| Sin rate limiting en endpoints | `index.js` | Instalado `express-rate-limit` para `/send`, `/learn`, `/keep-alive` |
| Dependencias vulnerables | `package.json` | `npm audit fix` aplicado; quedan 3 altas sin fix automático |

---

## ⚠️ Problemas que aún requieren atención

### Arquitectura
- `index.js` tiene ~3000 líneas. Es un **monolito** difícil de mantener.
- Hay **tres scripts de conexión paralelos**: `index.js`, `connect-whatsapp.js`, `wweb-final.js`.
- Muchas **variables globales mutables** (`conversations`, `floodCounters`, `analytics`, etc.).
- **Cero tests**.

### Performance / Estabilidad
- **Memory leaks** potenciales por `Maps` sin TTL (`floodCounters`, `messageFingerprints`, `userPreferences`, `analytics.*`).
- **Tres mecanismos keep-alive/reconnect** que pueden crear race conditions.
- El circuit breaker tiene side effects y no tiene estado `half-open`.
- El health check siempre devuelve 200 aunque WhatsApp esté desconectado.
- La cola de mensajes es secuencial global: un usuario lento bloquea a todos.

### Seguridad
- Quedan **3 vulnerabilidades altas** en dependencias transitivas sin fix automático:
  - `link-preview-js` (SSRF) — dependencia de Baileys
  - `xlsx` (prototype pollution / ReDoS) — SheetJS
- Los backups de sesión **podrían estar en el historial de Git**.
- Los endpoints auxiliares `connect-whatsapp.js`, `wweb-final.js`, `necio-brain.js` no tienen autenticación si se ejecutan.

### DevOps
- `render.yaml` usa plan free; Render duerme de todos modos.
- Falta logging estructurado y observabilidad.

---

## 📋 Plan de refactorización recomendado

### Fase 1 — Seguridad y estabilidad (esta semana)
1. Rotar todas las keys y revocar sesión de WhatsApp.
2. Limpiar historial de Git si aplica.
3. Unificar los mecanismos de reconexión en un solo orquestador.
4. Agregar TTL y límites a todas las estructuras en memoria.
5. Hacer que `/health` refleje el estado real de WhatsApp.

### Fase 2 — Modularización (próximas 2 semanas)
1. Separar `index.js` en módulos:
   - `src/whatsapp/` — conexión, envío, parseo
   - `src/ai/` — providers, dispatcher, circuit breaker, caché
   - `src/brain/` — emociones, small talk, comandos, procesador
   - `src/antiBan/` — flood, spam, rate limit
   - `src/rag/` — knowledge loader, chunker, búsqueda
   - `src/db/` — Supabase
   - `src/web/` — Express routes
2. Eliminar o consolidar `connect-whatsapp.js`, `wweb-final.js`, `necio-brain.js`.
3. Crear una configuración centralizada validada.

### Fase 3 — Tests y calidad
1. Instalar `vitest` o `jest`.
2. Escribir tests unitarios para: emociones, small talk, anti-ban, RAG, comandos, dispatcher.
3. Agregar CI básico con `npm run lint:syntax` y `npm test`.

### Fase 4 — Escalabilidad
1. Reemplazar TF-IDF casero por Qdrant (ya está en dependencias).
2. Implementar cola concurrente por usuario.
3. Agregar logging estructurado con `pino`.

---

## 🛠️ Cómo re-desplegar en Fly.io

```bash
# 1. Configura los secrets (usa valores reales)
fly secrets set GROQ_API_KEY="nueva_key" \
                GEMINI_API_KEY="nueva_key" \
                API_SECRET="clave_larga_aleatoria" \
                ADMIN_WHATSAPP="18297837862" \
                SUPABASE_URL="..." \
                SUPABASE_KEY="..."

# 2. Reconstruye y despliega
fly deploy

# 3. Si necesitas vincular de nuevo
fly ssh console
# dentro del contenedor:
RESET_SESSION=true node index.js
```

---

## 📞 Próximos pasos

Si quieres, puedo seguir con cualquiera de estas opciones:

1. **Limpiar el historial de Git** de keys y credenciales.
2. **Modularizar `index.js`** en la estructura propuesta.
3. **Agregar tests unitarios** básicos.
4. **Mejorar el sistema de reconexión** para evitar race conditions.
5. **Auditar `connect-whatsapp.js`, `wweb-final.js` y `necio-brain.js`** para decidir si eliminarlos.

---

*Revisión realizada con análisis de seguridad, arquitectura y performance.*
