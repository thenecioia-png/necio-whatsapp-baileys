const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const fs = require('fs');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_pairing');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    
    if (connection === 'open') {
      console.log('[✅] CONECTADO!');
      process.exit(0);
    }
    
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) {
        console.log('[!] Reconectando...');
        start();
      }
    }
  });

  // Request pairing code after a short delay
  setTimeout(async () => {
    try {
      const phoneNumber = process.argv[2] || '';
      if (!phoneNumber) {
        console.log('Uso: node whatsapp-pairing.js +1829XXXXXXXX');
        process.exit(1);
      }
      const code = await sock.requestPairingCode(phoneNumber);
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('  CODIGO DE EMPAREJAMIENTO:');
      console.log('  ' + code);
      console.log('═══════════════════════════════════════');
      console.log('');
      console.log('Instrucciones:');
      console.log('1. Abre WhatsApp en tu celular');
      console.log('2. Ajustes → Dispositivos vinculados');
      console.log('3. Vincular con numero de telefono');
      console.log('4. Introduce este codigo: ' + code);
      console.log('');
    } catch (e) {
      console.log('Error al generar codigo:', e.message);
    }
  }, 3000);
}

start();
