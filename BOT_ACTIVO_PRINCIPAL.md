# 🤖 BOT ACTIVO PRINCIPAL — Necio WhatsApp v3

> **⚠️ IMPORTANTE:** Este es el ÚNICO bot de WhatsApp que está activo y funcionando.
> Los otros dos (`the-necio-whatsapp-bot` Meta API y `necio-bot-wwebjs`) NO están funcionando.

---

## 📋 Identificación

| Campo | Valor |
|-------|-------|
| **Nombre** | Necio WhatsApp Bot v3 — Multi-IA |
| **Repo GitHub** | `necio-whatsapp-baileys` |
| **Carpeta local** | `C:\Users\susecomp\necio-whatsapp-bot-rebuild` |
| **Número admin** | 8297837862 |
| **Nube** | Fly.io |
| **URL** | https://necio-whatsapp-bot-v3.fly.dev |
| **App Fly.io** | `necio-whatsapp-bot-v3` |
| **Volumen** | `necio_whatsapp_data` (1GB, persistencia de sesión) |
| **Estado objetivo** | Conectado 24/7 |

---

## 🔗 URLs importantes

| Uso | URL |
|-----|-----|
| **Escanear QR** | https://necio-whatsapp-bot-v3.fly.dev/qr-html |
| **QR (API/JSON)** | https://necio-whatsapp-bot-v3.fly.dev/qr |
| **Estado** | https://necio-whatsapp-bot-v3.fly.dev/status |
| **Health** | https://necio-whatsapp-bot-v3.fly.dev/health |
| **Panel web** | https://necio-whatsapp-bot-v3.fly.dev/learn |
| **Enviar mensaje** | POST https://necio-whatsapp-bot-v3.fly.dev/send |

---

## 🆘 ¿Se desconectó? ¿Cómo volver a conectar?

1. Abre en tu celular: **https://necio-whatsapp-bot-v3.fly.dev/qr-html**
2. Apunta la cámara de WhatsApp al QR (Ajustes → Dispositivos vinculados → Vincular)
3. Listo. El bot se reconectará solo.

---

## 🛠️ Mejoras aplicadas (2026-05-20)

- ✅ Healthcheck real: Fly.io reinicia el contenedor si WhatsApp se desconecta
- ✅ Backoff exponencial en reconexiones (evita ban por reintentos agresivos)
- ✅ Límite de 20 intentos de reconexión antes de rotar sesión automáticamente
- ✅ Notificación al admin apunta a la URL correcta de Fly.io
- ✅ Endpoint `/qr-html` amigable para escanear fácil
- ✅ URLs internas corregidas de Railway → Fly.io
- ✅ Volumen persistente en Fly.io para no perder sesión entre reinicios

## 💓 Sistema Keep-Alive 24/7 (2026-05-23) — TODO AUTOMÁTICO

El bot tiene **3 capas** para que nunca se duerma. **Ya está todo configurado**, no tienes que hacer nada:

| Capa | Método | Frecuencia | Estado |
|------|--------|------------|--------|
| 1 | **GitHub Actions** (externo, nube) | Cada 5 minutos | ✅ Configurado |
| 2 | **Self-ping interno** | Cada 4 minutos | ✅ Configurado |
| 3 | **Endpoint `/keep-alive`** | Cada ping + reconexión automática | ✅ Configurado |

### ¿Cómo funciona?

1. **GitHub Actions** corre en los servidores de Microsoft y visita tu bot cada 5 minutos desde internet real. Esto evita que Fly.io "duerma" la app por falta de tráfico.
2. **Self-ping interno**: el propio bot se hace requests a sí mismo cada 4 minutos como respaldo.
3. **Endpoint `/keep-alive`**: cada vez que recibe un ping, revisa si WhatsApp está conectado. Si está caído, **reconecta automáticamente** (máximo 1 vez por minuto para no spamear).

### URLs de monitoreo (puedes abrirlas en el navegador)

| Endpoint | URL | Qué ves |
|----------|-----|---------|
| **Keep-Alive** | `https://necio-whatsapp-bot-v3.fly.dev/keep-alive` | Si el bot respondió y qué acción tomó |
| **Health** | `https://necio-whatsapp-bot-v3.fly.dev/health` | Estado del servidor + métricas de keep-alive |
| **Status** | `https://necio-whatsapp-bot-v3.fly.dev/status` | Si WhatsApp está realmente conectado |

> **Nota:** Si quieres desactivar la reconexión automática vía keep-alive, agrega a `.env`:
> `WHATSAPP_RECONNECT_ON_PING=false`

---

## 📁 Otros bots (NO FUNCIONAN — solo referencia)

| Bot | Estado | Por qué no usar |
|-----|--------|-----------------|
| `the-necio-whatsapp-bot` (Meta API) | Healthy pero desconfigurado | Requiere token Meta que expira |
| `necio-bot-wwebjs` (whatsapp-web.js) | Pending / nunca deployado | Puppeteer pesado, inestable |

---

*Última actualización: 2026-05-23*
*Autor: thenecioia-png*
