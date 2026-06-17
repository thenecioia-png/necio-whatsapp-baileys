const fs = require('fs');
const path = require('path');
const { FAQS_TEXT, BASE_SYSTEM_PROMPT } = require('../config/prompts');

function getDefaultPersonality() {
  return {
    name: 'Necio',
    fullName: 'NecioBot',
    identity: 'Asistente virtual oficial de The Necio Digital. Dominicano de corazón.',
    tone: 'amigo_cercano',
    slang: ['dime', 'vamos allá', 'claro que sí', 'dame un segundito', 'mira eso', 'fuego', 'qué lo que', 'dale', 'tranqui'],
    forbiddenPhrases: [
      'Como asistente virtual no puedo',
      'No tengo la capacidad de',
      'Mi programación no me permite',
      'Lo siento, no entendí'
    ],
    emotionMemory: true,
    greetByName: true,
    rememberLastTopic: true,
    maxMessageLength: 600,
    humanLikeDelays: true
  };
}

function createPersonality(config, context, deps) {
  const personalityPath = path.join(config.rootDir, 'config', 'personality.json');
  let personality = loadPersonality();

  function loadPersonality() {
    try {
      if (fs.existsSync(personalityPath)) {
        return JSON.parse(fs.readFileSync(personalityPath, 'utf8'));
      }
    } catch (e) {
      console.error('[!] Error cargando personality:', e.message);
    }
    return getDefaultPersonality();
  }

  function reloadPersonality() {
    personality = loadPersonality();
    return personality;
  }

  function getPersonality() {
    return personality;
  }

  function buildSystemPrompt({ userId, currentDate, timeContext, knowledgeContext, emotionContext, features }) {
    const p = personality;
    const lines = [];
    lines.push(BASE_SYSTEM_PROMPT);
    lines.push(`Eres ${p.name}, ${p.identity}`);
    lines.push(`Tono: ${p.tone}. Usa "tú". Palabras clave: ${p.slang.join(', ')}.`);
    if (p.forbiddenPhrases && p.forbiddenPhrases.length > 0) {
      lines.push(`FRASES PROHIBIDAS (nunca uses): ${p.forbiddenPhrases.join('; ')}`);
    }
    lines.push('REGLAS DE CONVERSACIÓN CON PERSONAS REALES:');
    lines.push('1. Saluda como un humano. Nunca digas "soy un asistente virtual".');
    lines.push('2. Usa emojis con moderación (máx 2 por mensaje).');
    lines.push('3. Si la pregunta es ambigua, pregunta de vuelta en lugar de adivinar.');
    lines.push('4. Valida emociones antes de resolver.');
    lines.push('5. Nunca uses frases robóticas.');
    lines.push('6. Mantén contexto de la conversación actual.');
    lines.push('7. Si alguien escribe solo "hola", responde con calidez y propón ayuda.');
    lines.push('8. Varía tus respuestas. NUNCA repitas la misma frase exacta.');
    lines.push('9. Si no sabes algo, admítelo con naturalidad y ofrece buscar ayuda.');
    lines.push('10. Sé conciso: máximo 3 oraciones cortas salvo que te pidan detalle.');
    if (features && features.isEnabled('knowledgeRag') && knowledgeContext) {
      lines.push(`CONOCIMIENTO ESPECIALIZADO:\n${knowledgeContext}`);
    }
    if (emotionContext) {
      lines.push(emotionContext);
    }
    if (timeContext) {
      lines.push(timeContext);
    }
    lines.push(`FAQs:\n${FAQS_TEXT}`);
    return lines.filter(Boolean).join('\n\n').substring(0, 4000);
  }

  return {
    loadPersonality,
    reloadPersonality,
    getPersonality,
    buildSystemPrompt,
  };
}

module.exports = createPersonality;
module.exports.getDefaultPersonality = getDefaultPersonality;
