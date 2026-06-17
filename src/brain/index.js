const { pickVariation } = require('../utils/helpers');

const GREETING_VARIATIONS = [
  '¡Hola! 👋 ¿En qué puedo ayudarte hoy?',
  'Hola, bienvenido. ¿Cómo puedo asistirte?',
  '¡Buen día! Cuéntame, ¿qué necesitas?',
  'Hola 👋 ¿Qué tal? Estoy aquí para ayudarte.',
  '¡Saludos! ¿En qué te puedo colaborar?',
];

const THANKS_VARIATIONS = [
  '¡Con gusto! 😊 Si necesitas algo más, aquí estoy.',
  'De nada. ¡Que tengas un excelente día!',
  'Para servirte. ¿Algo más en lo que pueda ayudarte?',
  'No hay de qué. Cuando quieras me escribes.',
];

const BUSY_VARIATIONS = [
  'Dame un momento, estoy procesando tu solicitud...',
  'Un segundo, déjame revisar eso...',
  'Estoy en ello, ya te respondo...',
  'Procesando... 🧠',
];

const FALLBACK_VARIATIONS = [
  'Lo siento, estoy teniendo dificultades técnicas. ¿Puedes reformular tu pregunta?',
  'Disculpa, no pude conectarme con mis servicios en este momento. Intenta de nuevo en unos segundos.',
  'Vaya, parece que hay un problema temporal. ¿Podemos intentarlo de nuevo?',
  'Estoy experimentando lentitud en mis servicios. Por favor, repite tu mensaje.',
];

function detectEmotion(text) {
  const lower = text.toLowerCase();
  const emotions = [];

  if (/\b(maldit|mierd|caraj|diabl|coñ|hosti|jod|put|estupi|idiot|imbéci|inúti|arrech|cabread|hart|fastidi|molest)\b/.test(lower)) emotions.push('angry');
  if (/\b(nunca funciona|siempre falla|que pesadez|que fastidio|estoy harto|no sirve|no responde|basura|inútil)\b/.test(lower)) emotions.push('frustrated');

  if (/\b(trist|preocup|miedo|ansied|estresad|desesperad|deprimid|solo|sola|ayuda por favor|no sé qué hacer)\b/.test(lower)) emotions.push('sad');

  if (/\b(gracias|te agradezco|excelente|perfecto|genial|increíble|me encant|feliz|content|alegr)\b/.test(lower)) emotions.push('happy');

  if (/\b(urgente|ahora mismo|inmediat|rápido|prisa|apúrate|ya|emergencia)\b/.test(lower)) emotions.push('urgent');

  if (/\b(claro que sí|obviamente|qué sorpresa|ya veo|mmhm|ajá|seguro|sí claro)\b/.test(lower) && lower.length < 50) emotions.push('skeptical');

  return emotions;
}

function getEmotionPrefix(emotions) {
  if (emotions.includes('angry') || emotions.includes('frustrated')) {
    return pickVariation([
      'Mira, entiendo que estás molesto. Vamos a resolver esto juntos.',
      'Vejo que estás tenso. Dame un segundito y te ayudo.',
      'Entiendo tu frustración. Cuéntame bien qué pasó para ver cómo lo arreglamos.',
    ]);
  }
  if (emotions.includes('sad')) {
    return pickVariation([
      'Entiendo que no es fácil. Estoy aquí para lo que necesites.',
      'Tranqui, vamos paso a paso. No estás solo en esto.',
      'Te escucho. Cuéntame todo lo que necesites.',
    ]);
  }
  if (emotions.includes('urgent')) {
    return pickVariation([
      'Entiendo la prisa. Voy directo al grano.',
      'Dime exactamente qué necesitas y lo resuelvo ya.',
    ]);
  }
  return '';
}

function isSmallTalk(text) {
  const lower = text.toLowerCase().trim();
  const patterns = [
    /^\b(hola|hey|buenas|buen día|buenas tardes|buenas noches|qué tal|cómo estás|cómo te va|cómo va todo|todo bien|qué hay|qué lo que|dime algo|cuéntame algo|saludos)\b/,
    /^\b(adiós|chao|hasta luego|nos vemos|me voy|bye|hasta mañana|cuídate|que estés bien)\b/,
    /^\b(gracias|muchas gracias|te lo agradezco|muy amable)\b$/,
    /^\b(de nada|con gusto|para servirte)\b$/,
    /^\b(jaja|lol|xd|ajá|ok|okay|vale|ya|mm|hm)\b$/,
    /\b(cuántos años tienes|quién eres|qué eres|eres humano|eres robot|te gusta|tu color favorito|tienes novi|estás solter|qué opinas de|cuéntame un chiste|dime algo gracioso|recomiéndame|aburrid)\b/,
  ];
  return patterns.some(p => p.test(lower));
}

function isGreeting(text) {
  const lower = text.toLowerCase().trim();
  return /^\b(hola|hey|buenas|buen día|buenas tardes|buenas noches|qué tal|cómo estás|cómo te va|qué lo que|saludos)\b/.test(lower) && text.length < 60;
}

function handleGreeting() {
  return pickVariation([
    '¿Qué lo que! 👋 ¿En qué te puedo echar una mano hoy?',
    '¡Buenas! ¿Cómo va todo? Dime qué necesitas.',
    'Hey, hey 👋 ¿Qué hay? Cuéntame.',
    '¿Qué tal? Aquí estoy. ¿En qué te ayudo?',
    '¡Saludos! ¿Qué vamos a resolver hoy?',
  ]);
}

function isFarewell(text) {
  const lower = text.toLowerCase().trim();
  return /^\b(adiós|chao|hasta luego|nos vemos|bye|hasta mañana|cuídate|que estés bien|me despido)\b/.test(lower) && text.length < 60;
}

function handleFarewell() {
  return pickVariation([
    'Dale, cuídate mucho. Si necesitas algo, me escribes. 👋',
    'Chao, chao. Que tengas un buen día. 🙌',
    'Nos vemos. Aquí estaré cuando me necesites.',
    'Hasta luego. Éxito con todo. 💪',
  ]);
}

function isThanks(text) {
  const lower = text.toLowerCase().trim();
  return /^\b(gracias|muchas gracias|te lo agradezco|muy amable|graciass)\b/.test(lower) && text.length < 80;
}

function handleThanks() {
  return pickVariation(THANKS_VARIATIONS);
}

function needsClarification(text) {
  const lower = text.toLowerCase().trim();
  if (lower.length < 8) return true;
  const vagueWords = ['eso', 'aquello', 'lo otro', 'la cosa', 'el tema', 'eso mismo', 'lo mismo', 'algo', 'cualquiera'];
  if (vagueWords.some(w => lower.includes(w))) return true;
  if (isGreeting(text) && !lower.includes('?') && text.length < 30) return false;
  return false;
}

function askClarification(text) {
  return pickVariation([
    'Mira, para darte lo mejor: ¿puedes darme un poco más de detalle?',
    'Dime con más calma qué necesitas exactamente.',
    'Quiero ayudarte bien. ¿A qué te refieres con eso?',
    'Entiendo la idea, pero necesito que me expliques un poquito más.',
  ]);
}

function rememberPreference(context, userId, key, value) {
  if (!context.userPreferences.has(userId)) context.userPreferences.set(userId, {});
  const prefs = context.userPreferences.get(userId);
  prefs[key] = value;
  prefs.lastUpdated = Date.now();
}

function getPreference(context, userId, key) {
  return context.userPreferences.get(userId)?.[key];
}

module.exports = {
  GREETING_VARIATIONS,
  THANKS_VARIATIONS,
  BUSY_VARIATIONS,
  FALLBACK_VARIATIONS,
  detectEmotion,
  getEmotionPrefix,
  isSmallTalk,
  isGreeting,
  handleGreeting,
  isFarewell,
  handleFarewell,
  isThanks,
  handleThanks,
  needsClarification,
  askClarification,
  rememberPreference,
  getPreference,
};
