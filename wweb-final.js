const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const http = require('http');

let qrData = null;
let ready = false;

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './wweb-final-auth' }),
    puppeteer: {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', async (qr) => {
    console.log('[+] QR generado');
    qrData = qr;
    await qrcode.toFile('./qr-final.png', qr, { width: 600 });
});

client.on('ready', () => {
    ready = true;
    qrData = null;
    console.log('[✅] WHATSAPP CONECTADO!');
});

client.on('message', async msg => {
    console.log(`[📩] ${msg.from}: ${msg.body.substring(0, 50)}`);
    
    // Reenviar a NECIO BRAIN proxy
    try {
        const phone = msg.from.replace(/@c\.us$|@g\.us$/, '');
        const payload = JSON.stringify({
            phone: phone,
            message: msg.body,
            name: msg._data?.notifyName || msg._data?.pushName || 'Cliente'
        });
        
        const req = http.request({
            hostname: 'localhost',
            port: 3457,
            path: '/process',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`[→BRAIN] ${res.statusCode}: ${data.substring(0, 100)}`);
            });
        });
        
        req.on('error', (err) => {
            console.log(`[→BRAIN] Error: ${err.message}`);
        });
        
        req.write(payload);
        req.end();
    } catch (e) {
        console.log(`[→BRAIN] Error enviando: ${e.message}`);
    }
});

client.initialize();

// Simple HTTP server
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<html><body style="text-align:center;background:#111;color:#fff;padding:40px;font-family:Arial">
            <h1 style="color:${ready?'#0f0':'#f55'}">${ready?'✅ CONECTADO':'⏳ ESCANEA EL QR'}</h1>
            ${!ready?'<img src="/qr" width="400"><p>WhatsApp → Ajustes → Dispositivos vinculados</p>':''}
        </body></html>`);
    } else if (req.url === '/qr') {
        try { res.writeHead(200,{'Content-Type':'image/png'}); res.end(fs.readFileSync('./qr-final.png')); }
        catch(e){ res.writeHead(404); res.end('QR no listo'); }
    } else if (req.url === '/send' && req.method==='POST') {
        let b=''; req.on('data',c=>b+=c); req.on('end',async()=>{
            try{ const d=JSON.parse(b); await client.sendMessage(d.number.includes('@')?d.number:`${d.number}@c.us`, d.text); res.end('{"ok":true}'); }
            catch(e){ res.writeHead(500); res.end('{"error":"'+e.message+'"}'); }
        });
    } else if (req.url === '/health') {
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({connected:ready}));
    } else { res.writeHead(404); res.end(); }
});
server.listen(3006, () => console.log('Servidor: http://localhost:3006'));
