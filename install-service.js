const Service = require('node-windows').Service;
const path = require('path');

const svc = new Service({
  name: 'Necio WhatsApp Bot v3',
  description: 'Bot de WhatsApp 24/7 con multi-IA fallback',
  script: path.join(__dirname, 'src', 'index.js'),
  cwd: __dirname,
  env: [
    { name: 'NODE_ENV', value: 'production' }
  ]
});

svc.on('install', () => {
  console.log('[✅] Servicio instalado. Iniciando...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('[ℹ️] Servicio ya instalado. Reiniciando...');
  svc.stop();
  setTimeout(() => svc.start(), 2000);
});

svc.on('start', () => {
  console.log('[🚀] Bot iniciado como servicio de Windows.');
  console.log('[📱] El bot está corriendo en background 24/7.');
  console.log('[🌐] Panel: http://localhost:3002');
});

svc.on('error', (err) => {
  console.error('[❌] Error:', err);
});

console.log('[⏳] Instalando servicio...');
svc.install();
