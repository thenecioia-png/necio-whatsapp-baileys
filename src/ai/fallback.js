const { FAQS_DATA } = require('../config/prompts');

function createFallback(config, context, deps) {
  function generateLocalReply(text) {
    const lower = text.toLowerCase();

    for (const faq of FAQS_DATA.faqs) {
      if (faq.keywords && faq.keywords.some(k => lower.includes(k))) {
        return faq.answer;
      }
    }

    const responses = [
      'Dame un momento que busco eso para ti.',
      'Ya voy, déjame revisar...',
      'Un segundito, estoy en eso.',
      'Espera, voy chequeando...',
    ];

    const hash = text.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return responses[hash % responses.length];
  }

  return { generateLocalReply };
}

module.exports = createFallback;
