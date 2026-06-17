FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libwebp-dev \
    libpng-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Asegurar directorios de trabajo (la sesión de WhatsApp persiste en volumen montado)
RUN mkdir -p auth_info_baileys config memory

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://localhost:3002/health', (r) => {process.exit(r && r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

CMD ["sh", "start.sh"]
