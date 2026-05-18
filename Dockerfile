# ═══════════════════════════════════════════════════════════════════
# Dockerfile - Necio WhatsApp Bot v2.1
# ═══════════════════════════════════════════════════════════════════

FROM node:20-slim

# Instalar dependencias del sistema necesarias para Baileys (libwebp, etc.)
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libwebp-dev \
    libpng-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar dependencias primero (cacheo de Docker)
COPY package*.json ./
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p auth_info_baileys config memory

# Puerto expuesto
EXPOSE 3002

# Healthcheck
# Healthcheck: solo verifica que el servidor responde
# WhatsApp puede no estar conectado todavía (necesita QR)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r && r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Comando de inicio
CMD ["node", "index.js"]
