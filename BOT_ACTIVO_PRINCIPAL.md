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

---

## 📁 Otros bots (NO FUNCIONAN — solo referencia)

| Bot | Estado | Por qué no usar |
|-----|--------|-----------------|
| `the-necio-whatsapp-bot` (Meta API) | Healthy pero desconfigurado | Requiere token Meta que expira |
| `necio-bot-wwebjs` (whatsapp-web.js) | Pending / nunca deployado | Puppeteer pesado, inestable |

---

*Última actualización: 2026-05-20*
*Autor: thenecioia-png*
