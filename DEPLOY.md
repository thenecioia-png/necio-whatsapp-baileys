# 🚀 Guía de Deploy - Necio WhatsApp Bot v3.0 (Multi-IA)

## ¿Qué hay de nuevo en v3.0?

**Fallback infinito de IAs:** Si una falla, entra la siguiente automáticamente:
1. **Groq** → rápido, 100k tokens/día gratis
2. **Google Gemini** → 60 req/min gratis
3. **OpenRouter** → docenas de modelos, algunos gratis
4. **Mistral** → freemium
5. **Respuesta local** → si TODAS fallan, el bot sigue respondiendo con inteligencia local

**Circuit Breaker:** Si una IA falla 3 veces, se salta por 5 minutos. No perdemos tiempo.

---

## 🔑 Paso 0: Obtener API Keys (TODAS GRATIS)

| Proveedor | URL | Límite Gratis |
|-----------|-----|---------------|
| **Groq** | https://console.groq.com/keys | 100,000 tokens/día |
| **Gemini** | https://aistudio.google.com/app/apikey | 60 requests/min |
| **OpenRouter** | https://openrouter.ai/keys | Depende del modelo (:free = gratis) |
| **Mistral** | https://console.mistral.ai/api-keys | Limitado (suficiente para backup) |

**Obligatorio:** Groq o Gemini (con una sola ya funciona, pero con más eres invencible)

---

## 🚀 Opción 1: Railway (Recomendada)

### 1. Crear cuenta
- Ve a https://railway.app
- Regístrate con GitHub

### 2. Instalar CLI
```bash
npm i -g @railway/cli
railway login
```

### 3. Inicializar proyecto
```bash
cd necio-whatsapp-baileys
railway init
```

### 4. Subir variables de entorno
```bash
railway variables --set "GROQ_API_KEY=tu_key"
railway variables --set "GEMINI_API_KEY=tu_key"
railway variables --set "OPENROUTER_API_KEY=tu_key"
railway variables --set "MISTRAL_API_KEY=tu_key"
railway variables --set "ADMIN_WHATSAPP=tu_numero"
railway variables --set "NODE_ENV=production"
railway variables --set "PERSIST_MEMORY=true"
```

### 5. Crear volúmenes persistentes (MUY IMPORTANTE)
En el dashboard de Railway:
- Ve a tu servicio → **Volumes**
- Crea volumen: mount path `/app/auth_info_baileys`
- Crea volumen: mount path `/app/memory`

Sin esto, cada reinicio pierdes la sesión de WhatsApp.

### 6. Deploy
```bash
railway up
```

### 7. Obtener URL
```bash
railway domain
```

### 8. Escanear QR
Visita `https://tu-app.railway.app/qr` desde tu celular y escanea.

---

## 💰 Costos Reales

**Railway:**
- Primeros $5 son gratis (1-2 meses típicamente)
- Después: ~$5-10/mes según uso

**Alternativa VPS barata:**
- Hetzner: ~$4.20/mes
- DigitalOcean: $6/mes
- Vultr: $5/mes

**Las APIs de IA:**
- Groq: gratis con límites (suficiente para un bot)
- Gemini: gratis con límites
- OpenRouter: modelos `:free` son gratis
- Mistral: freemium

**Total realista para 24/7:**
- Hosting: ~$5/mes
- IAs: $0 (con keys gratuitas)
- **Total: ~$5/mes**

---

## 🩺 Monitoreo

- `GET /` → estado general, circuit breakers, memoria
- `GET /health` → 200 si sano, 503 si desconectado
- Railway dashboard → logs y métricas en tiempo real

---

## 🔒 Seguridad

**NUNCA subas al repo:**
- `.env`
- `auth_info_baileys/` (creds de WhatsApp)
- `memory/conversations.json`

Ya están en `.gitignore` y `.dockerignore`.

---

## 🆘 Si todo falla

Si las 4 IAs fallan al mismo tiempo:
1. El bot **sigue respondiendo** con respuestas inteligentes locales
2. Busca keywords en las FAQs
3. Si no encuentra, da una respuesta genérica útil
4. **NUNCA** deja al usuario sin respuesta
5. Notifica al admin por WhatsApp
