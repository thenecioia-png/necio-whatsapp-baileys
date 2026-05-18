# 🤖 ANÁLISIS COMPLETO - Necio WhatsApp Bot v3.0
## Multi-IA · Anti-Ban · Conocimiento Inteligente · Gratis 24/7

**Fecha de creación:** Mayo 2026  
**Autor:** Kimi Code CLI para The Necio Digital  
**URL del bot:** https://necio-whatsapp-bot-v3-production.up.railway.app  
**Número objetivo:** +1 (829) 783-7862 (República Dominicana)

---

## 📋 ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Tecnologías Utilizadas](#3-tecnologías-utilizadas)
4. [APIs de IA Configuradas (Gratis)](#4-apis-de-ia-configuradas-gratis)
5. [Sistema Anti-Ban](#5-sistema-anti-ban)
6. [Sistema de Conocimiento](#6-sistema-de-conocimiento)
7. [Flujo de Mensajes](#7-flujo-de-mensajes)
8. [Endpoints HTTP](#8-endpoints-http)
9. [Comandos de WhatsApp](#9-comandos-de-whatsapp)
10. [Estructura del Código](#10-estructura-del-código)
11. [Deployment](#11-deployment)
12. [Costos](#12-costos)
13. [Seguridad](#13-seguridad)
14. [Futuras Mejoras](#14-futuras-mejoras)

---

## 1. RESUMEN EJECUTIVO

El **Necio WhatsApp Bot v3.0** es un asistente virtual de WhatsApp que:

- ✅ Funciona **24/7 gratis** usando APIs de IA gratuitas
- ✅ Tiene **7 proveedores de IA** en cadena de fallback (si uno falla, entra el siguiente)
- ✅ Simula comportamiento humano para **evitar bans de WhatsApp**
- ✅ Aprende de documentos (ventas, leyes, construcción, soldadura, herrería)
- ✅ Se despliega automáticamente en Railway con un solo comando
- ✅ Tiene panel web para gestionar conocimiento
- ✅ Notifica al admin cuando necesita atención humana

**Total de líneas de código:** ~1,800 (JavaScript/Node.js)

---

## 2. ARQUITECTURA DEL SISTEMA

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   USUARIO       │────▶│   WHATSAPP       │────▶│   RAILWAY       │
│   (Teléfono)    │◄────│   (Baileys v3)   │◄────│   (Node.js)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                    ┌──────────────────────────────────────┼─────────────────────────────┐
                    │                                      │                             │
                    ▼                                      ▼                             ▼
            ┌──────────────┐    ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │   CEREBRAS   │    │    GROQ      │   │   GEMINI     │   │  OPENROUTER  │
            │  (Primario)  │───▶│  (Secund.)   │──▶│  (Tercero)   │──▶│   (Cuarto)   │
            │ 1.5M tok/día │    │  100K tok/día│   │ 60 req/min   │   │   Gratis     │
            └──────────────┘    └──────────────┘   └──────────────┘   └──────────────┘
                                                                            │
                    ┌──────────────┐   ┌──────────────┐   ┌────────────────┘
                    │  TOGETHER AI │   │ GITHUB MODELS│   │    MISTRAL     │
                    │ 1M tok/mes   │──▶│  50 req/mes  │──▶│   Freemium     │
                    └──────────────┘   └──────────────┘   └────────────────┘
                                                                   │
                    ┌──────────────────────────────────────────────┘
                    │
                    ▼
            ┌──────────────┐
            │   RESPUESTA  │
            │   LOCAL      │
            │  (emergency) │
            └──────────────┘
```

### Componentes principales:
1. **Baileys v3** — Conexión a WhatsApp Web sin necesidad de teléfono secundario
2. **Express.js** — Servidor HTTP para endpoints, QR, panel web
3. **Sistema Multi-IA** — 7 APIs con circuit breaker y fallback automático
4. **Sistema Anti-Ban** — Delays, typing simulation, flood protection, session rotation
5. **Sistema de Conocimiento** — Carga documentos .md/.txt como contexto para la IA
6. **Cache de respuestas** — Evita llamadas repetidas a APIs
7. **Cola de mensajes** — Procesa mensajes secuencialmente

---

## 3. TECNOLOGÍAS UTILIZADAS

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Node.js | 22.x | Runtime |
| Express | 5.2.1 | Servidor HTTP |
| Baileys | 7.0.0-rc11 | Conexión WhatsApp |
| Multer | 2.1.1 | Subida de archivos |
| QRCode | 1.5.4 | Generación de QR |
| dotenv | 17.4.2 | Variables de entorno |
| body-parser | 2.2.2 | Parseo de requests |
| pg | 8.20.0 | PostgreSQL (futuro) |
| ioredis | 5.10.1 | Redis (futuro) |
| openai | 6.38.0 | Cliente OpenAI-compatible |

---

## 4. APIs DE IA CONFIGURADAS (GRATIS)

### Orden de Fallback (más barato → más costoso)

| # | Proveedor | Modelo | Límite Gratis | Tokens/día |
|---|-----------|--------|---------------|------------|
| 1 | **Cerebras** | llama-3.1-8b | 1,500,000 | 1.5M |
| 2 | **Groq** | llama-3.1-8b-instant | 100,000 | 100K |
| 3 | **Gemini** | gemini-1.5-flash | 60 req/min | Ilimitado* |
| 4 | **OpenRouter** | meta-llama-3.1-8b | Depende | Gratis :free |
| 5 | **Together AI** | Llama-3.1-8B | 1,000,000/mes | 1M/mes |
| 6 | **GitHub Models** | meta-llama-3.1-8b | 50 req/mes | 50/mes |
| 7 | **Mistral** | mistral-tiny | Freemium | Limitado |
| 8 | **Local** | Keywords | ∞ | ∞ |

> **Nota:** Con Cerebras como primario, el bot rara vez llega a Groq. Con Groq como respaldo, rara vez llega a Gemini. Esto hace que el bot sea virtualmente gratis para uso moderado.

### URLs para obtener API Keys:
- Cerebras: https://cloud.cerebras.ai/platform
- Groq: https://console.groq.com/keys
- Gemini: https://aistudio.google.com/app/apikey
- OpenRouter: https://openrouter.ai/keys
- Together AI: https://api.together.xyz/settings/api-keys
- GitHub Models: https://github.com/settings/tokens (scope: models_read)
- Mistral: https://console.mistral.ai/api-keys

---

## 5. SISTEMA ANTI-BAN

WhatsApp detecta y banea bots que se comportan de forma robótica. Implementamos:

### 5.1 Simulación de Typing
```javascript
// 20% de probabilidad de NO simular typing (más humano)
if (Math.random() > 0.2) {
  // Delay proporcional a la longitud del mensaje
  const chars = content.length;
  const delay = (chars / 5) * (60 / TYPING_SPEED_WPM) * 1000;
  await delayRandom(delay * 0.8, delay * 1.2);
}
```

### 5.2 Delays Humanizados
- **Min:** 400ms | **Max:** 2,500ms
- Jitter aleatorio ±20% en cada operación

### 5.3 Flood Protection
- Máximo 15 mensajes por minuto por usuario
- Cooldown de 2 minutos si se excede
- Responde con advertencia en lugar de ignorar silenciosamente

### 5.4 Spam Detection
- Detecta mensajes idénticos repetidos
- Umbral: 3 repeticiones
- Responde pidiendo variación

### 5.5 Session Rotation
- Si hay múltiples errores 401, rota la sesión automáticamente
- Mantiene backups de sesiones anteriores

### 5.6 Configuración de Browser
```javascript
browser: ['Chrome (Linux)', '', '']  // Genérico, no "Baileys"
markOnlineOnConnect: false           // No siempre "en línea"
```

---

## 6. SISTEMA DE CONOCIMIENTO

El bot puede aprender temas especializados y usarlos al responder.

### 6.1 Cómo funciona
1. Los archivos `.md` o `.txt` se guardan en `/knowledge/`
2. Al iniciar, el bot extrae keywords de cada archivo
3. Cuando un usuario pregunta, busca coincidencias de keywords
4. Si encuentra match (score ≥ 2), incluye el contenido en el system prompt

### 6.2 Temas precargados
| Archivo | Tema | Tamaño |
|---------|------|--------|
| ventas.md | Técnicas de ventas, precios, procesos | 960 bytes |
| leyes.md | Contratos, leyes RD, protección de datos | 865 bytes |
| construccion.md | Estructuras, materiales, normas | 675 bytes |
| soldadura.md | SMAW, MIG, TIG, seguridad | 804 bytes |
| herreria.md | Herramientas, procesos, acabados | 722 bytes |

### 6.3 Métodos para agregar conocimiento

#### A) Desde WhatsApp
```
Usuario: /aprender electricidad
Bot: 📝 Modo aprendizaje activado. Envíame el contenido...
Usuario: [texto largo sobre electricidad]
Bot: ✅ ¡Aprendí electricidad!
```

#### B) Desde la Web
URL: https://necio-whatsapp-bot-v3-production.up.railway.app/learn
- Formulario para escribir tema + contenido
- Subida de archivos .md/.txt

#### C) Por API
```bash
curl -X POST https://.../upload-knowledge \
  -H "X-API-Key: neciobot2026seguro" \
  -d '{"filename":"electricidad.md","content":"..."}'
```

---

## 7. FLUJO DE MENSAJES

```
1. Usuario envía mensaje
   │
   ▼
2. Baileys recibe el mensaje
   │
   ▼
3. Verificaciones Anti-Ban
   ├── ¿Flood? → Advertencia + return
   ├── ¿Spam? → Advertencia + return
   ├── ¿Patrón agresivo? → Respuesta calmada + return
   │
   ▼
4. Procesar comandos (/ayuda, /temas, /aprender, etc.)
   │
   ▼
5. Verificar modo humano
   ├── Si está activo → Ignorar, notificar admin
   │
   ▼
6. Rate limiting (10s entre mensajes)
   │
   ▼
7. Buscar en caché
   ├── ¿Pregunta repetida? → Devolver respuesta cacheada
   │
   ▼
8. Buscar conocimiento relevante
   ├── ¿Match con algún tema? → Incluir en contexto
   │
   ▼
9. Llamar a IA (Cerebras → Groq → Gemini → ...)
   ├── ¿Éxito? → Devolver respuesta
   ├── ¿Fallo? → Siguiente IA en cadena
   └── ¿Todas fallan? → Respuesta local
   │
   ▼
10. Enviar respuesta al usuario con typing simulation
   │
   ▼
11. Notificar admin si fue fallback o necesita humano
```

---

## 8. ENDPOINTS HTTP

| Endpoint | Método | Auth | Descripción |
|----------|--------|------|-------------|
| `/` | GET | No | Estado general del bot |
| `/health` | GET | No | Healthcheck para Railway |
| `/status` | GET | No | Estado de conexión WhatsApp |
| `/qr` | GET | No | Página HTML con QR para escanear |
| `/send` | POST | Sí | Enviar mensaje por HTTP |
| `/human-mode` | POST | Sí | Activar/desactivar modo humano |
| `/upload-knowledge` | POST | Sí | Subir conocimiento vía JSON |
| `/upload-file` | POST | Sí | Subir archivo .md/.txt |
| `/reload-knowledge` | POST | Sí | Recargar base de conocimiento |
| `/knowledge` | GET | Sí | Listar temas actuales |
| `/learn` | GET | No | Página web para gestionar conocimiento |

**Auth:** `X-API-Key: neciobot2026seguro` o `Authorization: Bearer neciobot2026seguro`

---

## 9. COMANDOS DE WHATSAPP

| Comando | Descripción |
|---------|-------------|
| `/ayuda` o `/help` | Lista de comandos disponibles |
| `/estado` | Ver si el bot está conectado |
| `/humano` | Solicitar atención humana |
| `/bot` | Reactivar bot tras modo humano |
| `/temas` | Ver temas que el bot conoce |
| `/aprender [tema]` | Enseñarle un tema nuevo |
| `/olvidar [tema]` | Borrar un tema |
| `/cancelar` | Cancelar modo aprendizaje |

---

## 10. ESTRUCTURA DEL CÓDIGO

```
necio-whatsapp-baileys/
│
├── index.js              ← Archivo principal (~1,800 líneas)
│                           - Servidor Express
│                           - Conexión Baileys
│                           - Multi-IA fallback
│                           - Anti-ban system
│                           - Knowledge base
│
├── package.json          ← Dependencias
├── Dockerfile            ← Container para Railway
├── docker-compose.yml    ← Stack local completo
├── .env.example          ← Variables de entorno de ejemplo
├── DEPLOY.md             ← Guía de deployment
│
├── knowledge/            ← Documentos de conocimiento
│   ├── ventas.md
│   ├── leyes.md
│   ├── construccion.md
│   ├── soldadura.md
│   └── herreria.md
│
├── config/
│   └── faqs.json         ← Preguntas frecuentes
│
├── memory/               ← Persistencia de conversaciones
│   └── conversations.json
│
├── auth_info_baileys/    ← Credenciales de WhatsApp
│   └── (NO subir al repo)
│
└── node_modules/         ← Dependencias
    └── (NO subir al repo)
```

---

## 11. DEPLOYMENT

### 11.1 En Railway (Actual)
```bash
# 1. Login
railway login

# 2. Entrar al proyecto
cd necio-whatsapp-baileys

# 3. Subir cambios
railway up

# 4. Ver logs
railway logs
```

### 11.2 Variables de Entorno en Railway
```
CEREBRAS_API_KEY=********
GROQ_API_KEY=********
GEMINI_API_KEY=********
OPENROUTER_API_KEY=********
TOGETHER_API_KEY=********
GITHUB_MODELS_TOKEN=********
MISTRAL_API_KEY=********
ADMIN_WHATSAPP=18297837862
API_SECRET=neciobot2026seguro
NODE_ENV=production
PERSIST_MEMORY=true
ANTI_BAN_ENABLED=true
```

### 11.3 Volúmenes Persistentes
| Volumen | Mount Path | Uso |
|---------|-----------|-----|
| WhatsApp Session | `/app/auth_info_baileys` | No perder sesión al reiniciar |
| Memoria | `/app/memory` | Guardar conversaciones |

---

## 12. COSTOS

### Gratis (0$)
- ✅ Todas las APIs de IA (con límites gratuitos)
- ✅ Railway ($5 crédito inicial)
- ✅ Dominio .railway.app
- ✅ HTTPS automático

### Potencialmente de pago
- ⚠️ Railway después de $5 crédito: ~$5-10/mes
- ⚠️ Si excedes límites de APIs gratis (raro con Cerebras)

### Alternativas económicas
| Servicio | Precio/mes | Notas |
|----------|-----------|-------|
| Hetzner VPS | ~$4.20 | Más control, necesitas administrar |
| DigitalOcean | $6 | Simple, buen uptime |
| Vultr | $5 | Opción budget |

---

## 13. SEGURIDAD

### Implementado
- 🔒 API Secret en endpoints sensibles
- 🔒 Keys de IA en variables de entorno (nunca en código)
- 🔒 `.gitignore` excluye `.env`, `auth_info_baileys/`, `memory/`
- 🔒 `.dockerignore` excluye datos sensibles
- 🔒 Validación de inputs en endpoints

### Recomendaciones
- ⚠️ Rotar API keys periódicamente
- ⚠️ No compartir el API Secret (`neciobot2026seguro`)
- ⚠️ Monitorear logs para detectar abuso
- ⚠️ Usar HTTPS siempre (Railway lo hace automático)

---

## 14. FUTURAS MEJORAS

### Fase 2: RAG + Vector Memory
- [ ] Qdrant para búsqueda semántica de conocimiento
- [ ] Embeddings para match inteligente (no solo keywords)
- [ ] Memoria a largo plazo con PostgreSQL + Redis

### Fase 3: n8n Workflows
- [ ] Automatización de tareas con n8n
- [ ] Webhooks para integraciones externas
- [ ] Notificaciones automatizadas

### Fase 4: Admin Panel
- [ ] Dashboard web con estadísticas
- [ ] Gestión de usuarios bloqueados
- [ ] Logs en tiempo real

### Fase 5: Multi-Agent
- [ ] Especialistas por dominio (ventas, soporte, técnico)
- [ ] Router inteligente de conversaciones
- [ ] Escalamiento automático

---

## 📊 ESTADÍSTICAS DEL PROYECTO

| Métrica | Valor |
|---------|-------|
| Líneas de código | ~1,800 |
| Archivos del proyecto | 15+ |
| APIs de IA integradas | 7 |
| Proveedores de fallback | 7 + local |
| Documentos de conocimiento | 5 |
| Comandos de WhatsApp | 8 |
| Endpoints HTTP | 11 |
| Variables de entorno | 25+ |
| Dependencias npm | 11 |

---

## 🔗 ENLACES IMPORTANTES

| Recurso | URL |
|---------|-----|
| Bot en producción | https://necio-whatsapp-bot-v3-production.up.railway.app |
| QR para escanear | https://necio-whatsapp-bot-v3-production.up.railway.app/qr |
| Panel de conocimiento | https://necio-whatsapp-bot-v3-production.up.railway.app/learn |
| Railway Dashboard | https://railway.com/project/a2403402-c86b-4945-8f1a-579311da4d2d |

---

## 📝 NOTAS FINALES

Este bot fue construido con la filosofía de **"funcionar gratis sin depender de un solo proveedor"**. La clave del éxito es:

1. **Redundancia:** 7 APIs de IA = casi imposible que todas fallen
2. **Optimización:** Cache + circuit breaker + contexto truncado = ahorro de tokens
3. **Humanización:** Anti-ban = bot sobrevive más tiempo sin ser detectado
4. **Escalabilidad:** Knowledge base + comandos = crece con el negocio

**El bot está listo para producción y puede atender clientes 24/7 sin costo mensual alguno** (mientras duren los créditos gratuitos de las APIs y Railway).

---

*Documento generado por Kimi Code CLI — The Necio Digital*
