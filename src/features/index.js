const fs = require('fs');
const path = require('path');

function getDefaultFeatures() {
  return {
    version: '1.0.0',
    updatedAt: '',
    modules: {
      greeting: { enabled: true, description: 'Saludos y despedidas automáticas' },
      emotionDetection: { enabled: true, description: 'Detecta emociones y adapta el tono' },
      knowledgeRag: { enabled: true, description: 'Usa archivos de conocimiento cargados' },
      crm: { enabled: true, description: 'Comandos /cliente, /estado, /etiqueta, /miinfo' },
      finance: { enabled: true, description: 'Comandos /ingreso, /gasto, /balance' },
      learning: { enabled: true, description: 'Comandos /aprender, /temas, /olvidar' },
      humanMode: { enabled: true, description: 'Comando /humano para escalar' },
      analytics: { enabled: true, description: 'Estadísticas y seguimiento' },
      antiBan: { enabled: true, description: 'Protección anti-flood y anti-spam' },
      typingSimulation: { enabled: true, description: 'Simula que está escribiendo' }
    },
    ai: {
      primaryProvider: 'pollinations',
      fallbackProviders: ['groq', 'gemini', 'openrouter', 'mistral'],
      temperature: 0.7,
      maxTokens: 250,
      useCache: true,
      timeoutMs: 15000
    },
    personality: {
      tone: 'amigo_dominicano',
      useEmojis: true,
      maxEmojisPerMessage: 2,
      useLocalSlang: true,
      autoFollowUp: false,
      followUpDelayMinutes: 30
    }
  };
}

function createFeatures(config, context, deps) {
  const featuresPath = path.join(config.rootDir, 'config', 'features.json');
  let features = loadFeatures();

  function loadFeatures() {
    try {
      if (fs.existsSync(featuresPath)) {
        return JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
      }
    } catch (e) {
      console.error('[!] Error cargando features:', e.message);
    }
    return getDefaultFeatures();
  }

  function saveFeatures(data) {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(featuresPath, JSON.stringify(data, null, 2), 'utf8');
    features = data;
    console.log('[✅] Features actualizadas:', featuresPath);
    return features;
  }

  function reloadFeatures() {
    features = loadFeatures();
    return features;
  }

  function isEnabled(moduleName) {
    return !!features.modules[moduleName]?.enabled;
  }

  function getAI() {
    return features.ai;
  }

  function getPersonality() {
    return features.personality;
  }

  function getAll() {
    return features;
  }

  function updateFeatures(patch) {
    const merged = { ...features, ...patch };
    return saveFeatures(merged);
  }

  return {
    loadFeatures,
    saveFeatures,
    reloadFeatures,
    isEnabled,
    getAI,
    getPersonality,
    getAll,
    updateFeatures,
  };
}

module.exports = createFeatures;
module.exports.getDefaultFeatures = getDefaultFeatures;
