/**
 * 🧠 NECIO BRAIN — Proxy directo para el bot de WhatsApp
 * Reemplaza temporalmente el workflow de n8n mientras se arregla
 */

const http = require('http');
const https = require('https');

// Configuración
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const BACKEND_URL = 'http://localhost:3456';
const WHATSAPP_SEND_URL = 'http://localhost:3006/send';

// Prompts de sistema para cada intención
const SYSTEM_PROMPTS = {
  saludo: `Eres el asistente de The Necio Digital. Saluda amablemente al usuario. Si es cliente nuevo, dale la bienvenida y pregunta en qué puedes ayudarle. Si es cliente recurrente, salúdalo por nombre. Máximo 2 oraciones. Tono muy cercano y amigable.`,
  cita: `Eres el asistente de citas de The Necio Digital. El usuario quiere agendar una cita. Extrae fecha, hora y servicio del mensaje. Si falta algún dato, pregúntalo amablemente. Si tienes todos los datos, confirma la cita. Máximo 2 oraciones. Tono profesional y cercano.`,
  info: `Eres el asistente de información de The Necio Digital. Responde al usuario usando la información proporcionada. Si no sabes algo, di que lo consultarás con el equipo. Máximo 2 oraciones. NUNCA inventes precios.`,
  presupuesto: `Eres el asistente de presupuestos de The Necio Digital. El usuario quiere un presupuesto. Pregunta amablemente qué necesita exactamente (tipo de proyecto, características, plazo). Máximo 2 oraciones.`,
  soporte: `Eres el asistente de soporte técnico de The Necio Digital. El usuario tiene un problema. Evalúa si es urgente o puede esperar. Pide más detalles si es necesario. Máximo 2 oraciones.`,
  compra: `Eres el asistente de ventas de The Necio Digital. El usuario quiere comprar algo. Pregunta qué necesita exactamente. Máximo 2 oraciones. Tono profesional y entusiasta.`,
  venta: `Eres el asistente de compras de The Necio Digital. El usuario quiere vender algo. Pregunta qué ofrece y en qué condiciones. Máximo 2 oraciones. Tono profesional.`,
  otro: `Eres el asistente inteligente de The Necio Digital. Responde al usuario de forma amable y profesional. Detecta si necesita algo específico. Máximo 2 oraciones.`
};

// Llamar a Groq
async function callGroq(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 300
    });

    const req = https.request({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.choices[0].message.content.trim());
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Llamar al backend
async function callBackend(action, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ action, ...data });
    const req = http.request({
      hostname: 'localhost',
      port: 3456,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Enviar mensaje por WhatsApp
async function sendWhatsApp(number, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ number, text });
    const req = http.request({
      hostname: 'localhost',
      port: 3006,
      path: '/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Clasificar intención
async function classifyIntent(message) {
  const prompt = `Eres el clasificador de intenciones de The Necio Digital. Clasifica el mensaje del usuario en UNA sola categoría: cita, info, presupuesto, soporte, compra, venta, saludo, u otro. Responde SOLO con la palabra de la categoría, nada más.`;
  const result = await callGroq(prompt, message);
  const intent = result.toLowerCase().trim();
  
  const validIntents = ['cita', 'info', 'presupuesto', 'soporte', 'compra', 'venta', 'saludo', 'otro'];
  return validIntents.includes(intent) ? intent : 'otro';
}

// Procesar mensaje
async function processMessage(phone, name, message) {
  console.log(`[🧠] Procesando: ${phone} → "${message.substring(0, 50)}"`);

  try {
    // 1. Buscar cliente
    const client = await callBackend('find_client', { phone, name });
    console.log(`[👤] Cliente: ${client.client_name_db || name} (nuevo: ${!client.client_exists})`);

    // 2. Clasificar intención
    const intent = await classifyIntent(message);
    console.log(`[🎯] Intención: ${intent}`);

    // 3. Preparar contexto para la IA
    let systemPrompt = SYSTEM_PROMPTS[intent] || SYSTEM_PROMPTS.otro;
    let userMessage = message;

    if (intent === 'saludo') {
      userMessage = `${message}. Nombre: ${client.client_name_db || name}. Es nuevo: ${!client.client_exists}`;
    }

    // 4. Buscar en KB si es info
    let kbInfo = '';
    if (intent === 'info') {
      try {
        const kb = await callBackend('search_kb', { query: message });
        kbInfo = kb.kb_found ? kb.kb_match?.answer || '' : '';
      } catch (e) {
        console.log('[KB] Error:', e.message);
      }
      if (kbInfo) {
        userMessage = `Pregunta: ${message}. Información: ${kbInfo}`;
      }
    }

    // 5. Generar respuesta con Groq
    const response = await callGroq(systemPrompt, userMessage);
    console.log(`[💬] Respuesta: ${response.substring(0, 80)}...`);

    // 6. Guardar conversación
    await callBackend('save_conversation', {
      phone,
      name: client.client_name_db || name,
      message,
      response,
      intent,
      timestamp: new Date().toISOString()
    });

    // 7. Guardar lead/cita/ticket según intención
    if (intent === 'presupuesto') {
      await callBackend('save_lead', { phone, name, message, source: 'whatsapp' });
    } else if (intent === 'soporte') {
      await callBackend('save_ticket', { phone, name, message, status: 'abierto' });
    } else if (intent === 'cita') {
      await callBackend('save_appointment', { phone, name, message, status: 'pendiente' });
    }

    // 8. Enviar respuesta por WhatsApp
    await sendWhatsApp(phone, response);
    console.log(`[✅] Mensaje enviado a ${phone}`);

    return { success: true, intent, response };

  } catch (error) {
    console.error(`[❌] Error procesando mensaje:`, error.message);
    
    // Enviar mensaje de error amable
    try {
      await sendWhatsApp(phone, 'Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentar de nuevo?');
    } catch (e) {}
    
    return { success: false, error: error.message };
  }
}

// Servidor HTTP para recibir mensajes desde whatsapp-web.js
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/process' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { phone, message, name } = data;
        
        if (!phone || !message) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Faltan phone o message' }));
          return;
        }

        const result = await processMessage(phone, name || 'Cliente', message);
        res.writeHead(result.success ? 200 : 500);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  } else if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', mode: 'necio-brain-proxy' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3457;
server.listen(PORT, () => {
  console.log(`\n🧠 NECIO BRAIN escuchando en http://localhost:${PORT}`);
  console.log(`   Endpoint: POST http://localhost:${PORT}/process`);
  console.log(`   Body: { "phone": "...", "message": "...", "name": "..." }`);
  console.log(`\n   Este proxy reemplaza temporalmente el workflow de n8n.\n`);
});

module.exports = { processMessage };
