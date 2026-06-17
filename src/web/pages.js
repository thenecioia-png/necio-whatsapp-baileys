function createPages(config, context, deps) {
  const { apiSecret } = config;

  function qrGeneratingPage() {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp QR - Necio Bot</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff;text-align:center;padding:20px}h1{margin-bottom:10px}p{color:#aaa}.loader{border:4px solid #333;border-top:4px solid #0f0;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>
<script>setInterval(()=>location.reload(),3000)</script>
</head><body><h1>⏳ Generando QR...</h1><div class="loader"></div><p>Espera unos segundos y recarga la página.</p></body></html>`;
  }

  function qrPage(qrDataUrl) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp QR - Necio Bot</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111;color:#fff;text-align:center;padding:20px}h1{margin-bottom:10px}img{max-width:90vw;border-radius:12px;box-shadow:0 0 40px rgba(0,255,0,.3)}p{color:#aaa;margin-top:15px}.refresh{color:#0f0;font-size:14px;margin-top:20px}</style>
<script>setInterval(()=>fetch('/').then(r=>r.json()).then(d=>{if(!d.qrAvailable)location.reload()}),5000)</script>
</head><body><h1>📱 Escanea con WhatsApp</h1><img src="${qrDataUrl}" alt="QR Code"><p>Ajustes → Dispositivos vinculados → Vincular dispositivo</p><p class="refresh">⏳ Este QR se actualiza automáticamente</p></body></html>`;
  }

  function qrHtmlGeneratingPage() {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WhatsApp QR - Necio Bot</title>
<style>body{font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff;text-align:center;padding:20px}h1{margin-bottom:10px}p{color:#aaa}.loader{border:4px solid #333;border-top:4px solid #0f0;border-radius:50%;width:40px;height:40px;animation:spin 1s linear infinite;margin:20px}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>
<script>setInterval(()=>location.reload(),3000)</script>
</head><body><h1>⏳ Generando QR...</h1><div class="loader"></div><p>Espera unos segundos y recarga la página.</p><p style="font-size:12px;color:#666;margin-top:20px">Si tarda más de 1 minuto, el bot puede estar reiniciando.</p></body></html>`;
  }

  async function learnPage() {
    const topics = context.knowledgeIndex.map(k => {
      const chunkCount = context.knowledgeChunks.filter(c => c.topic === k.topic).length;
      return `<li><b>${k.topic}</b> <span style="color:#888;font-size:12px">(${k.file} · ${chunkCount} chunks)</span></li>`;
    }).join('') || '<li style="color:#888">No hay temas aún</li>';

    const topTopics = [...context.analytics.topicsUsed.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t, c]) => `<li>${t}: <b>${c}</b> consultas</li>`)
      .join('') || '<li style="color:#888">Sin datos aún</li>';

    const topProviders = [...context.analytics.iaProviderUsage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([p, c]) => `<li>${p}: <b>${c}</b></li>`)
      .join('') || '<li style="color:#888">Sin datos aún</li>';

    let clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">Cargando...</td></tr>';
    try {
      if (context.dbEnabled && context.supabase) {
        const { data: clients } = await context.supabase.from('contacts').select('*').order('last_seen', { ascending: false }).limit(20);
        if (clients && clients.length > 0) {
          clientsHtml = clients.map(c => `<tr>
            <td>${c.name || 'Sin nombre'}</td>
            <td>${c.phone.split('@')[0]}</td>
            <td><span class="badge badge-${c.status || 'nuevo'}">${c.status || 'nuevo'}</span></td>
            <td>${c.tags?.join(', ') || '-'}</td>
            <td>${c.message_count || 0}</td>
          </tr>`).join('');
        } else {
          clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">No hay clientes aún</td></tr>';
        }
      } else {
        clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">Supabase no conectado</td></tr>';
      }
    } catch (e) {
      clientsHtml = '<tr><td colspan="5" style="color:#888;text-align:center">Error cargando clientes</td></tr>';
    }

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📚 Enseñar al Bot - Necio Digital</title>
<style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:#0f0f23;color:#e0e0e0;max-width:900px;margin:0 auto;padding:20px;line-height:1.6}
h1{color:#00d4ff;text-align:center;margin-bottom:5px}
.sub{text-align:center;color:#888;font-size:14px;margin-bottom:30px}
.card{background:#1a1a2e;border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid #2a2a4e}
.card h2{color:#00d4ff;margin-top:0;font-size:18px}
label{display:block;margin:12px 0 5px;color:#aaa;font-size:13px;text-transform:uppercase;letter-spacing:1px}
input[type=text],textarea{width:100%;padding:10px;border-radius:8px;border:1px solid #333;background:#0f0f23;color:#e0e0e0;font-size:14px}
textarea{min-height:180px;resize:vertical;font-family:inherit}
input[type=file]{padding:10px 0;color:#ccc}
.btn{background:#00d4ff;color:#000;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;width:100%;margin-top:10px}
.btn:hover{background:#00b8e6}
.btn-secondary{background:#2a2a4e;color:#e0e0e0}
.btn-secondary:hover{background:#3a3a6e}
.topics{max-height:200px;overflow-y:auto;background:#0f0f23;border-radius:8px;padding:10px 15px;margin-top:10px}
.topics li{margin:6px 0}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.stat{background:#0f0f23;border-radius:8px;padding:12px;text-align:center}
.stat-value{color:#00d4ff;font-size:22px;font-weight:700}
.stat-label{color:#888;font-size:12px}
.success{color:#0f0;background:#0f0f23;padding:12px;border-radius:8px;border:1px solid #0f0;margin-bottom:15px;display:none}
.error{color:#f55;background:#0f0f23;padding:12px;border-radius:8px;border:1px solid #f55;margin-bottom:15px;display:none}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}
th{text-align:left;color:#888;padding:8px;border-bottom:1px solid #333}
td{padding:8px;border-bottom:1px solid #222}
.badge{padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600}
.badge-nuevo{background:#2a2a4e;color:#aaa}
.badge-contactado{background:#1a3a4e;color:#5af}
.badge-cotizado{background:#1a3a1e;color:#5f5}
.badge-cerrado{background:#1a2a1e;color:#0f0}
.badge-perdido{background:#3a1a1e;color:#f55}
.lead-caliente{color:#f55;font-weight:600}
.lead-tibio{color:#fa0}
.lead-frio{color:#888}
small{color:#666;font-size:12px}
</style>
</head>
<body>
<h1>📚 Enseñar al Bot</h1>
<p class="sub">Agrega conocimiento para que el bot responda mejor</p>

<div id="msgSuccess" class="success"></div>
<div id="msgError" class="error"></div>

<div class="card">
  <h2>📊 Estadísticas de Uso</h2>
  <div class="stats">
    <div class="stat"><div class="stat-value">${context.analytics.messagesToday}</div><div class="stat-label">Mensajes hoy</div></div>
    <div class="stat"><div class="stat-value">${context.analytics.messagesTotal}</div><div class="stat-label">Mensajes totales</div></div>
    <div class="stat"><div class="stat-value">${context.analytics.uniqueUsers.size}</div><div class="stat-label">Usuarios únicos</div></div>
    <div class="stat"><div class="stat-value">${context.knowledgeChunks.length}</div><div class="stat-label">Chunks cargados</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:15px">
    <div>
      <h3 style="color:#888;font-size:13px;margin:0 0 8px 0">🏆 Temas más consultados</h3>
      <ul class="topics" style="max-height:150px">${topTopics}</ul>
    </div>
    <div>
      <h3 style="color:#888;font-size:13px;margin:0 0 8px 0">🤖 Uso de IAs</h3>
      <ul class="topics" style="max-height:150px">${topProviders}</ul>
    </div>
  </div>
</div>

<div class="card">
  <h2>👥 Clientes y Leads (CRM)</h2>
  <table>
    <thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th>Etiquetas</th><th>Msgs</th></tr></thead>
    <tbody>${clientsHtml}</tbody>
  </table>
  <small>💡 Los estados son: nuevo → contactado → cotizado → cerrado | perdido</small>
</div>

<div class="card">
  <h2>📝 Método 1: Escribir directamente</h2>
  <form id="textForm">
    <label>Nombre del tema</label>
    <input type="text" id="topicName" placeholder="ej: electricidad, plomeria, contabilidad" required>
    <label>Contenido</label>
    <textarea id="topicContent" placeholder="Escribe aquí todo lo que el bot debe saber sobre este tema..." required></textarea>
    <small>💡 Consejo: El bot divide automáticamente en chunks inteligentes. Puedes escribir textos largos.</small>
    <button type="submit" class="btn">💾 Guardar Tema</button>
  </form>
</div>

<div class="card">
  <h2>📁 Método 2: Subir archivo</h2>
  <form id="fileForm" enctype="multipart/form-data">
    <label>Archivo (.md o .txt)</label>
    <input type="file" id="fileInput" accept=".md,.txt,.pdf,.docx,.xlsx,.csv" required>
    <small>El nombre del archivo será el nombre del tema.</small>
    <button type="submit" class="btn btn-secondary">📤 Subir Archivo</button>
  </form>
</div>

<div class="card">
  <h2>📋 Temas actuales (${context.knowledgeIndex.length} temas · ${context.knowledgeChunks.length} chunks)</h2>
  <ul class="topics">${topics}</ul>
  <button class="btn btn-secondary" onclick="reloadKnowledge()">🔄 Recargar Conocimiento</button>
</div>

<script>
const API_KEY = '${apiSecret || 'neciobot2026seguro'}';

function show(id, text) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 5000);
}

document.getElementById('textForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('topicName').value.trim();
  const content = document.getElementById('topicContent').value.trim();
  if (!name || !content) return;
  try {
    const res = await fetch('/upload-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ filename: name + '.md', content })
    });
    const data = await res.json();
    if (data.success) {
      show('msgSuccess', '✅ Tema guardado: ' + data.file);
      document.getElementById('topicName').value = '';
      document.getElementById('topicContent').value = '';
      setTimeout(() => location.reload(), 1500);
    } else {
      show('msgError', '❌ Error: ' + (data.error || 'desconocido'));
    }
  } catch (err) {
    show('msgError', '❌ Error de red: ' + err.message);
  }
};

document.getElementById('fileForm').onsubmit = async (e) => {
  e.preventDefault();
  const file = document.getElementById('fileInput').files[0];
  if (!file) return;
  const form = new FormData();
  form.append('knowledge', file);
  try {
    const res = await fetch('/upload-file', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY },
      body: form
    });
    const data = await res.json();
    if (data.success) {
      show('msgSuccess', '✅ Archivo subido: ' + data.file);
      document.getElementById('fileInput').value = '';
      setTimeout(() => location.reload(), 1500);
    } else {
      show('msgError', '❌ Error: ' + (data.error || 'desconocido'));
    }
  } catch (err) {
    show('msgError', '❌ Error de red: ' + err.message);
  }
};

async function reloadKnowledge() {
  try {
    const res = await fetch('/reload-knowledge', {
      method: 'POST',
      headers: { 'X-API-Key': API_KEY }
    });
    const data = await res.json();
    if (data.success) {
      show('msgSuccess', '🔄 Recargado: ' + data.loaded + ' temas, ' + data.chunks + ' chunks');
      setTimeout(() => location.reload(), 1000);
    }
  } catch (err) {
    show('msgError', '❌ ' + err.message);
  }
}
</script>
</body>
</html>`;
  }

  return {
    qrGeneratingPage,
    qrPage,
    qrHtmlGeneratingPage,
    learnPage,
  };
}

module.exports = createPages;
