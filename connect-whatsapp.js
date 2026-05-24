const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const http = require('http');
const fs = require('fs');

let sock = null;
let qrGenerated = false;
let connected = false;

async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['Windows', 'Chrome', '10.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
        defaultQueryTimeoutMs: 60000,
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr && !qrGenerated) {
            qrGenerated = true;
            console.log('[+] QR generado - Escanea ahora');
            try {
                await QRCode.toFile('./qr-code.png', qr, { width: 600 });
                console.log('[+] QR guardado en qr-code.png');
            } catch (e) {
                console.log('[!] Error guardando QR:', e.message);
            }
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                    statusCode !== DisconnectReason.forbidden;
            console.log(`[!] Conexion cerrada. Codigo: ${statusCode}. Reconectar: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                qrGenerated = false;
                setTimeout(connect, 5000);
            }
        } else if (connection === 'open') {
            connected = true;
            qrGenerated = false;
            console.log('[✅] WHATSAPP CONECTADO EXITOSAMENTE!');
            console.log(`[✅] Numero: ${sock.user?.id}`);
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            const msg = m.messages[0];
            console.log(`[📩] Mensaje de ${msg.key.remoteJid}: ${msg.message?.conversation?.substring(0, 50) || '[media]'}`);
        }
    });
}

// HTTP server
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.url === '/') {
        const html = connected ? 
            `<h1 style="color:green;text-align:center;font-family:Arial">✅ CONECTADO</h1><p style="text-align:center">${sock.user?.id || ''}</p>` :
            `<h1 style="color:red;text-align:center;font-family:Arial">⏳ Escanea el QR</h1><p style="text-align:center"><img src="/qr" width="400"></p>`;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html><html><body style="background:#111;color:#fff;padding:40px">${html}</body></html>`);
    }
    else if (req.url === '/qr') {
        try {
            const img = fs.readFileSync('./qr-code.png');
            res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
            res.end(img);
        } catch (e) {
            res.writeHead(404); res.end('QR no listo');
        }
    }
    else if (req.url === '/send' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const jid = data.number.includes('@') ? data.number : `${data.number}@s.whatsapp.net`;
                await sock.sendMessage(jid, { text: data.text });
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    }
    else if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ connected, user: sock?.user?.id || null }));
    }
    else {
        res.writeHead(404); res.end('Not found');
    }
});

server.listen(3005, () => {
    console.log('Servidor en http://localhost:3005');
});

connect();
