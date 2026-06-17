const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set(['este','esta','estos','estas','ese','esa','esos','esas','aquel','aquella',
  'para','como','con','que','los','las','del','por','una','uno','pero','más','desde','todos','todas',
  'este','esta','esto','estos','estas','ese','esa','eso','esos','esas','aquel','aquella','aquello',
  'aquellos','aquellas','el','la','lo','le','les','me','te','se','nos','os','mi','tu','su','sus',
  'mis','tus','nuestro','nuestra','nuestros','nuestras','vuestro','vuestra','vuestros','vuestras',
  'y','o','u','e','ni','pero','sino','mas','aunque','porque','pues','ya','si','no','tambien','tampoco',
  'a','ante','bajo','con','contra','de','desde','en','entre','hacia','hasta','para','por','segun',
  'sin','sobre','tras','durante','mediante','excepto','salvo','tan','tanto','muy','mucho','poco',
  'mas','menos','algo','nada','casi','solo','sólo','cada','otro','otra','otros','otras','mismo',
  'misma','mismos','mismas','tal','tales','cual','cuales','donde','cuando','como','quien','quienes',
  'cuyo','cuya','cuyos','cuyas','ser','estar','haber','tener','hacer','poder','decir','ir','ver',
  'dar','saber','querer','llegar','pasar','deber','poner','parecer','quedar','creer','hablar',
  'llevar','dejar','seguir','encontrar','llamar','venir','pensar','salir','volver','tomar','conocer',
  'sentir','tratar','mirar','contar','empezar','esperar','buscar','existir','entrar','trabajar',
  'escribir','perder','producir','ocurrir','entender','pedir','recibir','recordar','terminar',
  'permitir','aparecer','conseguir','comenzar','servir','sacar','necesitar','mantener','resultar',
  'leer','caer','cambiar','presentar','crear','abrir','considerar','oír','acabar','convertir',
  'ganar','formar','traer','partir','morir','aceptar','realizar','suponer','comprender',
  'lograr','explicar','mostrar','preguntar','tocar','reconocer','estudiar','alcanzar','nacer',
  'cubrir','importar','cortar','correr','aprovechar','evitar','enviar','analizar','aumentar',
  'demostrar','jugar','parecer','usar','tener','ser','hacer','poder','decir','ir','ver','dar']);

function createRag(config, context) {
  const { knowledgeDir } = config;

  function extractKeywords(text) {
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !STOPWORDS.has(w));
  }

  function chunkDocument(text, chunkSize = 600, overlap = 150) {
    const chunks = [];
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);

    let currentChunk = '';
    for (const para of paragraphs) {
      if (currentChunk.length + para.length < chunkSize) {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = para;
      }
    }
    if (currentChunk) chunks.push(currentChunk.trim());

    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length <= chunkSize * 1.5) {
        finalChunks.push(chunk);
        continue;
      }
      const sentences = chunk.match(/[^.!?]+[.!?]+/g) || [chunk];
      let sentenceChunk = '';
      for (const sent of sentences) {
        if (sentenceChunk.length + sent.length < chunkSize) {
          sentenceChunk += sent;
        } else {
          if (sentenceChunk) finalChunks.push(sentenceChunk.trim());
          sentenceChunk = sent;
        }
      }
      if (sentenceChunk) finalChunks.push(sentenceChunk.trim());
    }

    return finalChunks.length > 0 ? finalChunks : [text.substring(0, chunkSize)];
  }

  function computeTf(words) {
    const tf = new Map();
    for (const w of words) tf.set(w, (tf.get(w) || 0) + 1);
    const maxFreq = Math.max(...tf.values(), 1);
    for (const [w, freq] of tf) tf.set(w, freq / maxFreq);
    return tf;
  }

  function computeIdf(allDocsWords) {
    const idf = new Map();
    const N = allDocsWords.length;
    const docFreq = new Map();
    for (const words of allDocsWords) {
      const unique = new Set(words);
      for (const w of unique) docFreq.set(w, (docFreq.get(w) || 0) + 1);
    }
    for (const [w, df] of docFreq) {
      idf.set(w, Math.log(N / (df + 1)) + 1);
    }
    return idf;
  }

  function tfidfScore(queryWords, docTf, idf) {
    let score = 0;
    for (const w of queryWords) {
      const tf = docTf.get(w) || 0;
      const idfVal = idf.get(w) || 1;
      score += tf * idfVal;
    }
    return score;
  }

  function loadKnowledge() {
    try {
      if (!fs.existsSync(knowledgeDir)) {
        fs.mkdirSync(knowledgeDir, { recursive: true });
        return;
      }
      context.knowledgeBase = new Map();
      context.knowledgeIndex = [];
      context.knowledgeChunks = [];
      context.idfCache = new Map();

      const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
      const allChunksWords = [];

      for (const file of files) {
        const content = fs.readFileSync(path.join(knowledgeDir, file), 'utf8');
        const keywords = extractKeywords(content);
        const topic = file.replace(/\.(md|txt)$/, '').toLowerCase();
        context.knowledgeBase.set(topic, content);

        context.knowledgeIndex.push({
          file,
          topic,
          keywords: [...new Set([...keywords, topic])].slice(0, 30),
          preview: content.substring(0, 200).replace(/\n/g, ' ')
        });

        const chunks = chunkDocument(content, 600, 150);
        for (let i = 0; i < chunks.length; i++) {
          const chunkText = chunks[i];
          const chunkKeywords = extractKeywords(chunkText);
          const chunkWords = [...chunkKeywords, ...topic.split(/[_\-]/)];
          allChunksWords.push(chunkWords);
          context.knowledgeChunks.push({
            topic,
            file,
            chunkIndex: i,
            text: chunkText,
            keywords: chunkKeywords,
            wordList: chunkWords
          });
        }
      }

      context.idfCache = computeIdf(allChunksWords);

      for (const chunk of context.knowledgeChunks) {
        chunk.tf = computeTf(chunk.wordList);
      }

      console.log(`[📚] Conocimiento cargado: ${context.knowledgeIndex.length} temas, ${context.knowledgeChunks.length} chunks`);
      for (const k of context.knowledgeIndex) {
        const chunkCount = context.knowledgeChunks.filter(c => c.topic === k.topic).length;
        console.log(`   • ${k.file} (${k.keywords.length} keywords, ${chunkCount} chunks)`);
      }
    } catch (e) {
      console.error('[!] Error cargando conocimiento:', e.message);
    }
  }

  function findRelevantKnowledge(userText, maxChars = 2500) {
    const userWords = extractKeywords(userText);
    if (userWords.length === 0) return null;

    const scoredChunks = [];
    for (const chunk of context.knowledgeChunks) {
      const score = tfidfScore(userWords, chunk.tf, context.idfCache);
      for (const w of userWords) {
        if (chunk.topic.includes(w)) score += 0.5;
      }
      if (score > 0) scoredChunks.push({ chunk, score });
    }

    scoredChunks.sort((a, b) => b.score - a.score);

    let totalChars = 0;
    const selectedChunks = [];
    for (const { chunk, score } of scoredChunks) {
      if (totalChars + chunk.text.length > maxChars) break;
      const isDuplicate = selectedChunks.some(c =>
        c.topic === chunk.topic &&
        (c.text.includes(chunk.text.substring(0, 50)) || chunk.text.includes(c.text.substring(0, 50)))
      );
      if (!isDuplicate) {
        selectedChunks.push(chunk);
        totalChars += chunk.text.length;
      }
    }

    if (selectedChunks.length === 0) return null;

    const parts = selectedChunks.map(c => `[${c.topic}]\n${c.text}`);
    return parts.join('\n\n---\n\n');
  }

  function reloadKnowledge() {
    loadKnowledge();
    return {
      loaded: context.knowledgeIndex.length,
      chunks: context.knowledgeChunks.length,
      topics: context.knowledgeIndex.map(k => k.topic)
    };
  }

  return { loadKnowledge, findRelevantKnowledge, reloadKnowledge };
}

module.exports = createRag;
