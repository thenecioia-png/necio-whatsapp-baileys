(function () {
  const API_KEY = window.NECIO_API_KEY || '';

  function $(id) {
    return document.getElementById(id);
  }

  function show(type, text) {
    const el = $('msg');
    el.className = 'msg ' + type;
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => {
      el.style.display = 'none';
      el.className = 'msg';
    }, 5000);
  }

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(path, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  let currentFeatures = null;

  async function loadFeatures() {
    try {
      currentFeatures = await api('/api/features');
      renderFeatures(currentFeatures);
      renderAI(currentFeatures);
      renderPersonality(currentFeatures);
      return currentFeatures;
    } catch (err) {
      show('error', 'Error cargando features: ' + err.message);
    }
  }

  function renderFeatures(features) {
    const container = $('features-list');
    if (!container || !features.modules) return;
    container.innerHTML = '';
    Object.entries(features.modules).forEach(([key, mod]) => {
      const row = document.createElement('div');
      row.className = 'switch-row';
      row.innerHTML = `
        <span><strong>${key}</strong><br><small style="color:var(--muted)">${mod.description || ''}</small></span>
        <label class="switch">
          <input type="checkbox" data-feature="${key}" ${mod.enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;
      container.appendChild(row);
    });
  }

  function renderAI(features) {
    if (!features.ai) return;
    const primary = $('ai-primary');
    const temp = $('ai-temperature');
    const tempVal = $('ai-temperature-value');
    const maxTokens = $('ai-max-tokens');
    const timeout = $('ai-timeout');
    const fallback = $('ai-fallback');

    if (primary) primary.value = features.ai.primaryProvider || 'pollinations';
    if (temp) {
      temp.value = features.ai.temperature ?? 0.7;
      tempVal.textContent = (features.ai.temperature ?? 0.7).toFixed(1);
    }
    if (maxTokens) maxTokens.value = features.ai.maxTokens || 250;
    if (timeout) timeout.value = features.ai.timeoutMs || 15000;
    if (fallback && features.ai.fallbackProviders) {
      fallback.value = features.ai.fallbackProviders.join(', ');
    }
  }

  function renderPersonality(features) {
    if (!features.personality) return;
    const useEmojis = $('p-use-emojis');
    const maxEmojis = $('p-max-emojis');
    const maxEmojisVal = $('p-max-emojis-value');
    const useSlang = $('p-use-slang');
    const autoFollow = $('p-auto-follow');
    const followDelay = $('p-follow-delay');

    if (useEmojis) useEmojis.checked = features.personality.useEmojis !== false;
    if (maxEmojis) {
      maxEmojis.value = features.personality.maxEmojisPerMessage || 2;
      maxEmojisVal.textContent = features.personality.maxEmojisPerMessage || 2;
    }
    if (useSlang) useSlang.checked = features.personality.useLocalSlang !== false;
    if (autoFollow) autoFollow.checked = features.personality.autoFollowUp === true;
    if (followDelay) followDelay.value = features.personality.followUpDelayMinutes || 30;
  }

  function collectFeatures() {
    const modules = {};
    document.querySelectorAll('[data-feature]').forEach(input => {
      modules[input.dataset.feature] = {
        enabled: input.checked,
        description: currentFeatures.modules[input.dataset.feature]?.description || '',
      };
    });

    const ai = {
      primaryProvider: $('ai-primary')?.value || currentFeatures.ai?.primaryProvider || 'pollinations',
      fallbackProviders: ($('ai-fallback')?.value || 'groq, gemini, openrouter, mistral')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      temperature: parseFloat($('ai-temperature')?.value ?? 0.7),
      maxTokens: parseInt($('ai-max-tokens')?.value || 250, 10),
      timeoutMs: parseInt($('ai-timeout')?.value || 15000, 10),
      useCache: currentFeatures.ai?.useCache !== false,
    };

    const personality = {
      tone: currentFeatures.personality?.tone || 'amigo_dominicano',
      useEmojis: $('p-use-emojis')?.checked ?? true,
      maxEmojisPerMessage: parseInt($('p-max-emojis')?.value || 2, 10),
      useLocalSlang: $('p-use-slang')?.checked ?? true,
      autoFollowUp: $('p-auto-follow')?.checked ?? false,
      followUpDelayMinutes: parseInt($('p-follow-delay')?.value || 30, 10),
    };

    return {
      ...currentFeatures,
      modules,
      ai,
      personality,
    };
  }

  async function saveFeatures() {
    try {
      const payload = collectFeatures();
      const data = await api('/api/features', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      currentFeatures = data.features;
      show('success', '✅ Configuración guardada');
    } catch (err) {
      show('error', 'Error guardando: ' + err.message);
    }
  }

  async function reloadFeatures() {
    try {
      const data = await api('/api/features/reload', { method: 'POST' });
      currentFeatures = data.features;
      renderFeatures(currentFeatures);
      renderAI(currentFeatures);
      renderPersonality(currentFeatures);
      show('success', '🔄 Features recargadas');
    } catch (err) {
      show('error', 'Error recargando: ' + err.message);
    }
  }

  async function loadStats() {
    try {
      const stats = await api('/stats');
      const set = (id, val) => {
        const el = $(id);
        if (el) el.textContent = val;
      };
      set('stat-total', stats.messagesTotal ?? 0);
      set('stat-today', stats.messagesToday ?? 0);
      set('stat-users', stats.uniqueUsers ?? 0);
      set('stat-fallback', stats.fallbackCount ?? 0);
      set('stat-topics', stats.knowledge?.topics ?? 0);
      set('stat-chunks', stats.knowledge?.chunks ?? 0);

      const providersEl = $('stat-providers');
      if (providersEl && stats.iaProviderUsage) {
        providersEl.innerHTML = stats.iaProviderUsage
          .map(([p, c]) => `<li>${p}: <strong>${c}</strong></li>`)
          .join('') || '<li style="color:var(--muted)">Sin datos</li>';
      }
    } catch (err) {
      console.error('Error cargando stats:', err.message);
    }
  }

  async function loadKnowledge() {
    try {
      const data = await api('/knowledge');
      const list = $('knowledge-list');
      if (list) {
        list.innerHTML = data.topics
          .map(t => `<li>${t.topic} <small style="color:var(--muted)">(${t.chunks} chunks)</small></li>`)
          .join('') || '<li style="color:var(--muted)">Sin temas</li>';
      }
      const total = $('knowledge-total');
      if (total) total.textContent = data.total ?? 0;
    } catch (err) {
      console.error('Error cargando conocimiento:', err.message);
    }
  }

  async function reloadKnowledge() {
    try {
      const data = await api('/reload-knowledge', { method: 'POST' });
      await loadKnowledge();
      show('success', `🔄 Recargado: ${data.loaded || data.topics?.length || 0} temas`);
    } catch (err) {
      show('error', 'Error recargando conocimiento: ' + err.message);
    }
  }

  async function uploadFile(file) {
    try {
      const form = new FormData();
      form.append('knowledge', file);
      const headers = API_KEY ? { 'X-API-Key': API_KEY } : {};
      const res = await fetch('/upload-file', {
        method: 'POST',
        headers,
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await loadKnowledge();
      show('success', '✅ Archivo subido: ' + data.file);
    } catch (err) {
      show('error', 'Error subiendo archivo: ' + err.message);
    }
  }

  async function confirmReconnect() {
    if (!confirm('¿Forzar reconexión de WhatsApp? No se borrará la sesión actual.')) return;
    try {
      await api('/api/session/reconnect', { method: 'POST' });
      show('success', '🔌 Reconexión iniciada');
    } catch (err) {
      show('error', 'Error en reconexión: ' + err.message);
    }
  }

  function init() {
    loadFeatures().then(() => {
      loadStats();
      loadKnowledge();
    });

    $('btn-save')?.addEventListener('click', saveFeatures);
    $('btn-reload')?.addEventListener('click', reloadFeatures);
    $('btn-reload-knowledge')?.addEventListener('click', reloadKnowledge);
    $('btn-reconnect')?.addEventListener('click', confirmReconnect);
    $('file-upload')?.addEventListener('change', e => {
      if (e.target.files[0]) uploadFile(e.target.files[0]);
    });

    $('ai-temperature')?.addEventListener('input', e => {
      $('ai-temperature-value').textContent = parseFloat(e.target.value).toFixed(1);
    });

    $('p-max-emojis')?.addEventListener('input', e => {
      $('p-max-emojis-value').textContent = e.target.value;
    });

    setInterval(() => {
      loadStats();
      loadKnowledge();
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
