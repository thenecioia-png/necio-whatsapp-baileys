# 🚀 Guía de Deploy - Necio WhatsApp Bot v3.1

## Cambios realizados en esta versión

- ✅ **Fix crítico**: `start.sh` ya NO borra la sesión en cada reinicio
- ✅ **Auto-keepalive**: Ping propio cada 5 minutos para mantener 24/7 activo
- ✅ **Watchdog**: Reconexión automática si WhatsApp desconecta > 10 min
- ✅ **Bot más inteligente**: Prompts conversacionales dominicanos, natural y cercano
- ✅ **Detección de emociones**: Detecta enojo, frustración, tristeza, urgencia
- ✅ **Small talk**: Saludos, despedidas, gracias — responde como un humano real
- ✅ **Escalamiento inteligente**: Si alguien está muy frustrado, ofrece humano automáticamente
- ✅ **Healthcheck mejorado**: Muestra estado real de WhatsApp + memoria

---

## Opción A: Fly.io (el que ya tienes)

**Nota:** Fly.io ya NO es 100% gratis 24/7. Con `min_machines_running = 1` te cobran ~$2-5/mes.

### Pasos:

1. Abre terminal en la carpeta del bot:
```bash
cd C:\Users\susecomp\necio-whatsapp-baileys-code
```

2. Hacer deploy:
```bash
fly deploy
```

3. Ver logs:
```bash
fly logs -a necio-whatsapp-bot-v3
```

4. Si no reconecta, forzar reset de sesión:
```bash
fly ssh console -a necio-whatsapp-bot-v3
# Dentro del contenedor:
rm -rf /app/auth_info_baileys/*
exit
fly restart -a necio-whatsapp-bot-v3
```

5. Escanear QR desde tu celular:
```
https://necio-whatsapp-bot-v3.fly.dev/qr-html
```

---

## Opción B: Render.com (100% gratis con keep-alive)

**Ventaja:** Plan gratuito real. Con el auto-keepalive que agregué, la app nunca se duerme.

### Pasos:

1. Sube tu código a GitHub (si no está ya)

2. Ve a https://dashboard.render.com

3. Click **New +** → **Blueprint**

4. Conecta tu repo de GitHub

5. Render leerá automáticamente el archivo `render.yaml`

6. Configura las variables de entorno en el dashboard de Render:
   - `ADMIN_WHATSAPP` = 18297837862
   - `API_SECRET` = tu_clave_secreta
   - `GROQ_API_KEY` = tu_key
   - `GEMINI_API_KEY` = tu_key
   - (y las demás que uses)

7. Deploy automático

8. La URL será: `https://necio-whatsapp-bot.onrender.com`

---

## Variables de entorno IMPORTANTES

```env
# ─── Keep-Alive (nuevo) ───
KEEP_ALIVE_ENABLED=true
KEEP_ALIVE_INTERVAL_MS=300000
PUBLIC_URL=https://tu-url-aqui.com

# ─── Watchdog (nuevo) ───
WATCHDOG_INTERVAL_MS=600000

# ─── Admin ───
ADMIN_WHATSAPP=18297837862

# ─── IAs (configura TODAS las que tengas) ───
GROQ_API_KEY=...
GEMINI_API_KEY=...
CEREBRAS_API_KEY=...
# ... etc
```

---

## Solución de problemas

### "QR no disponible"
- Espera 30-60 segundos después del deploy
- Si persiste, reinicia la app desde el dashboard

### "Desconectado constantemente"
- Verifica que `start.sh` NO borre la sesión (ya está fixeado)
- Asegúrate de escanear el QR rápido (expira en ~1 min)

### "Se duerme en Render"
- El auto-keepalive debería prevenir esto
- Verifica que `KEEP_ALIVE_ENABLED=true` esté configurado

---

## URLs útiles después del deploy

| URL | Uso |
|-----|-----|
| `/health` | Estado del servidor + WhatsApp |
| `/status` | Estado completo (503 si desconectado) |
| `/qr-html` | Escanear QR desde el celular |
| `/learn` | Panel web para subir conocimiento |
