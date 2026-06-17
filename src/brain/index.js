const { pickVariation } = require('../utils/helpers');

const GREETING_VARIATIONS = [
  '¿Qué lo que! 👋 ¿En qué te puedo echar una mano hoy?',
  '¡Buenas! ¿Cómo va todo? Dime qué necesitas.',
  'Hey, hey 👋 ¿Qué hay? Cuéntame.',
  '¿Qué tal? Aquí estoy. ¿En qué te ayudo?',
  '¡Saludos! ¿Qué vamos a resolver hoy?',
  'Dime, dime. ¿Qué necesitas?',
  '¿Cómo estamos? Cuéntame.',
  'Aquí al frente. ¿Qué lo que?',
  '¡Fuego! Dime qué vamos a hacer.',
  '¿Todo bien? Estoy ready.',
  '¿Qué lo que, mi pana? Dime en qué te ayudo.',
  '¡Buenas, buenas! ¿Cómo va eso?',
  'Dale, cuéntame. Estoy escuchando.',
  '¿En qué te puedo colaborar hoy?',
  'Saludos, saludos. ¿Qué necesitas?',
  '¿Qué vamos a mover hoy? Dime.',
  'Aquí estoy, ready. ¿Qué hay?',
  'Mira, dime. ¿En qué te ayudo?',
  '¡Hola, hola! ¿Cómo va todo?',
  '¿Qué necesitas resolver? Vamos allá.',
];

const THANKS_VARIATIONS = [
  '¡Con gusto! 😊 Si necesitas algo más, aquí estoy.',
  'De nada. ¡Que tengas un excelente día!',
  'Para servirte. ¿Algo más en lo que pueda ayudarte?',
  'No hay de qué. Cuando quieras me escribes.',
  'A ti, por confiar. Cualquier cosa me avisas.',
  'Con mucho gusto. ¿Necesitas algo más?',
  'Para eso estamos. 😊',
  'De nada, de nada. Cuídate.',
];

const BUSY_VARIATIONS = [
  'Dame un momentico, estoy procesando eso...',
  'Un segundito, déjame revisar...',
  'Estoy en ello, ya te respondo.',
  'Procesando... 🧠',
  'Dame un segundito, voy a ver eso.',
  'Un momentico, que estoy pensando...',
  'Ya mismo te respondo, dame un segundo.',
  'Estoy revisando la info, espera un poquito.',
];

const FALLBACK_VARIATIONS = [
  'Mira, ahora mismo estoy un poco lento con las IAs. ¿Puedes repetirme la pregunta?',
  'Dame un segundito, parece que hay un problema temporal. Intenta de nuevo en unos segundos.',
  'Vaya, ahora no puedo conectarme bien. Vamos a intentarlo de nuevo.',
  'Estoy teniendo un problema técnico por aquí. Repíteme lo que necesitas.',
  'Ahora mismo no tengo conexión con mis servicios. ¿Me lo preguntas de nuevo?',
  'Parece que las IAs están dormidas. Déjame intentar de nuevo.',
];

const CONFUSED_VARIATIONS = [
  'Mira, no estoy seguro de entender. ¿Puedes explicarme un poquito más?',
  'Dame más detalle, que quiero ayudarte bien.',
  'Eso no me quedó claro. ¿Me lo dices de otra forma?',
  'Perdona, ¿a qué te refieres exactamente?',
  'No capto bien. ¿Puedes ser más específico?',
  'Mmm, no estoy seguro. Cuéntame mejor.',
  'Eso suena interesante, pero necesito más contexto.',
  'Dame un ejemplo o más detalle para entenderte mejor.',
];

const UNKNOWN_ANSWER_VARIATIONS = [
  'Esa no me la sé, pero puedo intentar buscarte algo. ¿Te parece?',
  'Mira, de eso no tengo info ahora. ¿Quieres que lo aprenda?',
  'No tengo claro eso. Mejor te digo la verdad: no lo sé.',
  'Eso no lo manejo por aquí, pero puedo intentar ayudarte de otra forma.',
  'La verdad, no sé. Pero si me das más contexto, puedo intentar.',
  'No tengo la respuesta exacta, pero no te voy a inventar nada.',
  'Esa me queda grande por ahora. ¿Te ayudo con otra cosa?',
  'No lo sé, pero puedo aprenderlo si me enseñas.',
];

function detectEmotion(text) {
  const lower = text.toLowerCase();
  const emotions = [];

  if (/\b(maldit|mierd|caraj|diabl|coñ|hosti|jod|put|estupi|idiot|imbéci|inúti|arrech|cabread|hart|fastidi|molest|enojad|brav|furios|irritad)\b/.test(lower)) emotions.push('angry');
  if (/\b(nunca funciona|siempre falla|que pesadez|que fastidio|estoy harto|no sirve|no responde|basura|inútil|mala atención|no me gusta|qué desastre|qué mal|frustrante)\b/.test(lower)) emotions.push('frustrated');

  if (/\b(trist|preocup|miedo|ansied|estresad|desesperad|deprimid|solo|sola|ayuda por favor|no sé qué hacer|mal día|me siento mal|necesito ayuda)\b/.test(lower)) emotions.push('sad');

  if (/\b(gracias|te agradezco|excelente|perfecto|genial|increíble|me encant|feliz|content|alegr|emocionad|felicitaciones|bravo|qué bueno|me alegra)\b/.test(lower)) emotions.push('happy');

  if (/\b(urgente|ahora mismo|inmediat|rápido|prisa|apúrate|ya|emergencia|lo necesito ya|es grave|no tengo tiempo)\b/.test(lower)) emotions.push('urgent');

  if (/\b(seguro\?|de verdad|en serio|mmhm|ajá|ya veo|claro|ok|está bien|no estoy seguro|dudoso|sospechoso)\b/.test(lower) && lower.length < 80) emotions.push('skeptical');

  if (/\b(emocionad|emocionante|increíble|increible|espectacular|increíble|genial|qué emoción|no puedo esperar|ansios|feliz)\b/.test(lower)) emotions.push('excited');

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
  if (emotions.includes('excited')) {
    return pickVariation([
      '¡Me alegra ver esa energía! Vamos con todo.',
      '¡Esa actitud me gusta! Dime qué necesitas.',
    ]);
  }
  if (emotions.includes('skeptical')) {
    return pickVariation([
      'Entiendo que quieras estar seguro. Te explico con calma.',
      'Dame la oportunidad de aclararte eso.',
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
  return pickVariation(GREETING_VARIATIONS);
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
    'Dale pues, cuídate. Cualquier cosa me avisas.',
    'Nos vemos después. 👋',
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
  CONFUSED_VARIATIONS,
  UNKNOWN_ANSWER_VARIATIONS,
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
