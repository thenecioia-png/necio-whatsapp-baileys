const fs = require('fs');
const path = require('path');
const {
  detectEmotion,
  getEmotionPrefix,
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
  FALLBACK_VARIATIONS,
  THANKS_VARIATIONS,
  CONFUSED_VARIATIONS,
  UNKNOWN_ANSWER_VARIATIONS,
} = require('../brain');
const { getDisplayId, isValidUserJid, truncateText, pickVariation } = require('../utils/helpers');

function createProcessor(config, context, deps) {
  const {
    antiBanEnabled,
    adminWhatsApp,
    humanCommand,
    knowledgeDir,
    maxMessageLength,
    memoryMaxMessages,
    rateLimitSeconds,
  } = config;

  function isFeatureEnabled(name) {
    if (deps && typeof deps.isEnabled === 'function') {
      return deps.isEnabled(name);
    }
    return true;
  }

  const SYSTEM_MSG_COOLDOWN_MS = 30000;

  async function sendSystemMessage(userId, text) {
    const now = Date.now();
    const last = context.systemMessageThrottle.get(userId) || 0;
    if (now - last < SYSTEM_MSG_COOLDOWN_MS) return;
    context.systemMessageThrottle.set(userId, now);
    await deps.sendWhatsAppMessage(userId, text, { simulateTyping: false });
  }

  function getPersonalityConfig() {
    if (deps && typeof deps.getPersonality === 'function') {
      return deps.getPersonality();
    }
    return { useEmojis: true, maxEmojisPerMessage: 2, useLocalSlang: true };
  }

  async function processMessage(userId, name, text) {
    // Anti-ban: flood protection
    if (antiBanEnabled && isFeatureEnabled('antiBan')) {
      if (deps.isFlood && deps.isFlood(userId)) {
        console.log(`[🚫] Ignorando flood de ${getDisplayId(userId)}`);
        await sendSystemMessage(userId, '⏳ Estás enviando mensajes muy rápido. Dame un momento y te respondo.');
        return;
      }
      if (deps.isSpam && deps.isSpam(userId, text)) {
        console.log(`[🚫] Ignorando spam de ${getDisplayId(userId)}`);
        await sendSystemMessage(userId, '📝 Noté que estás repitiendo el mismo mensaje. ¿Hay algo más en lo que pueda ayudarte?');
        return;
      }
      if (deps.isAggressivePattern && deps.isAggressivePattern(text)) {
        console.log(`[🚫] Patrón agresivo detectado de ${getDisplayId(userId)}`);
        await deps.sendWhatsAppMessage(userId, 'Entiendo tu mensaje. Dame un momento para revisarlo. 😊', { simulateTyping: false });
        return;
      }
      if (deps.recordMessage) deps.recordMessage(userId);
    }

    // Modo aprendizaje
    const learnState = context.learningMode.get(userId);
    if (learnState && learnState.step === 'waiting_content') {
      if (!isFeatureEnabled('learning')) {
        context.learningMode.delete(userId);
        await deps.sendWhatsAppMessage(userId, '⚠️ El modo aprendizaje está desactivado ahora mismo.', { simulateTyping: false });
        return;
      }
      const topic = learnState.topic;
      const safeName = topic.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ_-]/g, '_').toLowerCase();
      const filePath = path.join(knowledgeDir, safeName + '.md');
      const header = `# ${topic.toUpperCase()}\n\n`;
      const fullContent = header + text.trim();
      try {
        fs.writeFileSync(filePath, fullContent, 'utf8');
        deps.reloadKnowledge();
        await deps.sendWhatsAppMessage(userId, `✅ ¡Aprendí *${topic}*!\n\nAhora sé sobre este tema y lo usaré cuando alguien pregunte.\n\n📚 Temas que conozco: ${context.knowledgeIndex.length}\n\nEscribe */temas* para ver la lista completa.`, { simulateTyping: false });
        console.log(`[📚] Nuevo conocimiento agregado por ${getDisplayId(userId)}: ${safeName}.md`);
      } catch (e) {
        await deps.sendWhatsAppMessage(userId, `❌ No pude guardar el tema. Error: ${e.message}`, { simulateTyping: false });
      }
      context.learningMode.delete(userId);
      return;
    }

    // Comando ayuda
    if (text.trim().toLowerCase() === '/ayuda' || text.trim().toLowerCase() === '/help') {
      await deps.sendWhatsAppMessage(userId, `🤖 *Comandos disponibles:*\n\n*Generales:*\n• */ayuda* - Ver esta lista\n• */humano* - Hablar con una persona\n• */bot* - Reactivarme\n• */estado* - Ver si estoy conectado\n\n*Conocimiento:*\n• */temas* - Ver lo que sé\n• */aprender [tema]* - Enseñarme algo nuevo\n• */olvidar [tema]* - Borrar un tema\n\n*CRM / Clientes:*\n• */cliente [nombre]* - Registrar tu nombre\n• */estado [nuevo|contactado|cotizado|cerrado|perdido]* - Cambiar estado\n• */etiqueta [tag]* - Agregar etiqueta\n• */miinfo* - Ver tu perfil\n• */historial* - Ver conversaciones recientes\n• */clientes* - Listar todos (admin)\n\n*Finanzas:*\n• */ingreso [monto] [desc]* - Registrar ingreso\n• */gasto [monto] [desc]* - Registrar gasto\n• */balance* - Ver finanzas\n\n*Admin:*\n• */stats* - Estadísticas completas\n\n📚 Web: https://necio-whatsapp-bot-v3.fly.dev/learn\n\n¿En qué puedo ayudarte?`, { simulateTyping: false });
      return;
    }

    // Comando estado
    if (text.trim().toLowerCase() === '/estado') {
      const status = context.isConnected ? '🟢 Conectado y listo' : '🔴 Desconectado';
      await deps.sendWhatsAppMessage(userId, `${status}\n📅 ${new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })}`, { simulateTyping: false });
      return;
    }

    // Comando /stats
    if (text.trim().toLowerCase() === '/stats') {
      const isAdmin = userId.includes(adminWhatsApp.replace(/\D/g, ''));
      if (!isAdmin) {
        await deps.sendWhatsAppMessage(userId, '⛔ Solo el admin puede ver estadísticas.', { simulateTyping: false });
        return;
      }
      const topTopics = [...context.analytics.topicsUsed.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, c]) => `• ${t}: ${c}`)
        .join('\n') || 'Ninguno aún';
      const topProviders = [...context.analytics.iaProviderUsage.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([p, c]) => `• ${p}: ${c}`)
        .join('\n') || 'Ninguno aún';
      await deps.sendWhatsAppMessage(userId, `📊 *Estadísticas del Bot*

📨 Mensajes hoy: ${context.analytics.messagesToday}
📨 Mensajes totales: ${context.analytics.messagesTotal}
👤 Usuarios únicos: ${context.analytics.uniqueUsers.size}
💬 Privados: ${context.analytics.privateMessages} | Grupos: ${context.analytics.groupMessages}
🆘 Fallbacks: ${context.analytics.fallbackCount}

🏆 *Temas más consultados:*
${topTopics}

🤖 *Uso de IAs:*
${topProviders}`, { simulateTyping: false });
      return;
    }

    // CRM comandos
    if (isFeatureEnabled('crm')) {
      const clienteMatch = text.trim().match(/^\/cliente\s+(.+)$/i);
      if (clienteMatch) {
        const nombre = clienteMatch[1].trim();
        const saved = await deps.updateContactStatus(userId, null);
        if (context.dbEnabled) {
          await context.supabase.from('contacts').update({ name: nombre }).eq('phone', userId);
          await deps.sendWhatsAppMessage(userId, `✅ Cliente registrado: *${nombre}*\n📱 ${getDisplayId(userId)}`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `⚠️ Modo local: Cliente *${nombre}* anotado.\nConecta Supabase para persistencia.`, { simulateTyping: false });
        }
        return;
      }

      const estadoMatch = text.trim().match(/^\/estado\s+(nuevo|contactado|cotizado|cerrado|perdido)$/i);
      if (estadoMatch) {
        const nuevoEstado = estadoMatch[1].toLowerCase();
        const saved = await deps.updateContactStatus(userId, nuevoEstado);
        if (saved) {
          await deps.sendWhatsAppMessage(userId, `✅ Estado actualizado a: *${nuevoEstado.toUpperCase()}*`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `⚠️ No se pudo guardar. ¿Supabase configurado?`, { simulateTyping: false });
        }
        return;
      }

      const etiquetaMatch = text.trim().match(/^\/etiqueta\s+(.+)$/i);
      if (etiquetaMatch) {
        const tag = etiquetaMatch[1].trim().toLowerCase().replace(/\s+/g, '_');
        const saved = await deps.addContactTag(userId, tag);
        if (saved) {
          await deps.sendWhatsAppMessage(userId, `🏷️ Etiqueta agregada: *${tag}*`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `⚠️ No se pudo guardar la etiqueta.`, { simulateTyping: false });
        }
        return;
      }

      if (text.trim().toLowerCase() === '/miinfo') {
        const contact = await deps.getContact(userId);
        if (contact) {
          const tags = contact.tags?.length ? contact.tags.join(', ') : 'Ninguna';
          await deps.sendWhatsAppMessage(userId, `👤 *Tu perfil*

📱 ${getDisplayId(userId)}
📝 ${contact.name || 'Sin nombre'}
📊 Estado: ${contact.status || 'nuevo'}
🏷️ Etiquetas: ${tags}
💬 Mensajes: ${contact.message_count || 0}
📅 Primer contacto: ${new Date(contact.first_seen).toLocaleDateString('es-DO')}
📅 Último contacto: ${new Date(contact.last_seen).toLocaleDateString('es-DO')}`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `👤 No tienes perfil aún. Escribe */cliente [tu nombre]* para crearlo.`, { simulateTyping: false });
        }
        return;
      }

      if (text.trim().toLowerCase() === '/historial') {
        const history = await deps.getContactHistory(userId, 10);
        if (history.length > 0) {
          const lines = history.map(h => `${h.role === 'user' ? '👤' : '🤖'} ${h.content.substring(0, 60)}...`).join('\n');
          await deps.sendWhatsAppMessage(userId, `📜 *Últimas conversaciones:*\n\n${lines}`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `📜 No hay historial aún.`, { simulateTyping: false });
        }
        return;
      }

      if (text.trim().toLowerCase() === '/clientes') {
        const isAdmin = userId.includes(adminWhatsApp.replace(/\D/g, ''));
        if (!isAdmin) {
          await deps.sendWhatsAppMessage(userId, '⛔ Solo el admin puede ver todos los clientes.', { simulateTyping: false });
          return;
        }
        const clients = await deps.listContacts(null, 30);
        if (clients.length === 0) {
          await deps.sendWhatsAppMessage(userId, `📋 No hay clientes registrados aún.`, { simulateTyping: false });
        } else {
          const lines = clients.map((c, i) => `${i + 1}. ${c.name || 'Sin nombre'} - ${c.phone.split('@')[0]} [${c.status}] (${c.message_count} msgs)`).join('\n');
          await deps.sendWhatsAppMessage(userId, `📋 *Clientes (${clients.length}):*\n\n${lines}`, { simulateTyping: false });
        }
        return;
      }
    }

    // Learning comandos
    if (isFeatureEnabled('learning')) {
      if (text.trim().toLowerCase() === '/temas') {
        if (context.knowledgeIndex.length === 0) {
          await deps.sendWhatsAppMessage(userId, `📚 Aún no sé nada.\n\nPara enseñarme:\n1. Escribe */aprender [tema]*\n2. Envíame el contenido\n\nO usa la web:\nhttps://necio-whatsapp-bot-v3.fly.dev/learn`, { simulateTyping: false });
        } else {
          const list = context.knowledgeIndex.map((k, i) => `${i + 1}. ${k.topic}`).join('\n');
          await deps.sendWhatsAppMessage(userId, `📚 *Temas que conozco (${context.knowledgeIndex.length}):*\n\n${list}\n\nPara ver uno en detalle, escribe */aprender [nombre]* y envía el contenido.`, { simulateTyping: false });
        }
        return;
      }

      const learnMatch = text.trim().match(/^\/aprender\s+(.+)$/i);
      if (learnMatch) {
        const topic = learnMatch[1].trim();
        context.learningMode.set(userId, { topic, step: 'waiting_content' });
        await deps.sendWhatsAppMessage(userId, `📝 *Modo aprendizaje activado: ${topic}*\n\nEnvíame todo el contenido sobre este tema en un solo mensaje (puedes escribirlo o copiar y pegar).\n\nYo lo guardaré y lo usaré cuando alguien pregunte sobre ${topic}.\n\nPara cancelar, escribe */cancelar*.`, { simulateTyping: false });
        return;
      }

      const forgetMatch = text.trim().match(/^\/olvidar\s+(.+)$/i);
      if (forgetMatch) {
        const topic = forgetMatch[1].trim().toLowerCase();
        const entry = context.knowledgeIndex.find(k => k.topic === topic || k.file.replace(/\.(md|txt)$/, '').toLowerCase() === topic);
        if (!entry) {
          await deps.sendWhatsAppMessage(userId, `❌ No encontré el tema "${topic}".\n\nEscribe */temas* para ver lo que sé.`, { simulateTyping: false });
        } else {
          try {
            fs.unlinkSync(path.join(knowledgeDir, entry.file));
            deps.reloadKnowledge();
            await deps.sendWhatsAppMessage(userId, `🗑️ Olvidé *${entry.topic}*. Ya no usaré ese conocimiento.`, { simulateTyping: false });
            console.log(`[📚] Conocimiento eliminado por ${getDisplayId(userId)}: ${entry.file}`);
          } catch (e) {
            await deps.sendWhatsAppMessage(userId, `❌ Error borrando: ${e.message}`, { simulateTyping: false });
          }
        }
        return;
      }
    }

    if (text.trim().toLowerCase() === '/cancelar') {
      if (context.learningMode.has(userId)) {
        context.learningMode.delete(userId);
        await deps.sendWhatsAppMessage(userId, `❌ Cancelado. No guardé nada.`, { simulateTyping: false });
      } else {
        await deps.sendWhatsAppMessage(userId, `No estabas enseñándome nada.`, { simulateTyping: false });
      }
      return;
    }

    // Contabilidad
    if (isFeatureEnabled('finance')) {
      const ingresoMatch = text.trim().match(/^\/(ingreso|entrada)\s+([\d,.]+)\s*(.*)?$/i);
      if (ingresoMatch) {
        const amount = parseFloat(ingresoMatch[2].replace(/,/g, ''));
        const desc = ingresoMatch[3]?.trim() || 'Ingreso registrado';
        const saved = await deps.saveTransaction(userId, 'ingreso', amount, desc, 'general');
        if (saved) {
          await deps.sendWhatsAppMessage(userId, `✅ Ingreso registrado:\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `⚠️ Ingreso anotado (modo local):\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}\n\n💡 Conecta PostgreSQL para persistencia.`, { simulateTyping: false });
        }
        return;
      }

      const gastoMatch = text.trim().match(/^\/(gasto|salida)\s+([\d,.]+)\s*(.*)?$/i);
      if (gastoMatch) {
        const amount = parseFloat(gastoMatch[2].replace(/,/g, ''));
        const desc = gastoMatch[3]?.trim() || 'Gasto registrado';
        const saved = await deps.saveTransaction(userId, 'gasto', amount, desc, 'general');
        if (saved) {
          await deps.sendWhatsAppMessage(userId, `✅ Gasto registrado:\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `⚠️ Gasto anotado (modo local):\n💵 $${amount.toLocaleString('es-DO')}\n📝 ${desc}\n\n💡 Conecta PostgreSQL para persistencia.`, { simulateTyping: false });
        }
        return;
      }

      if (text.trim().toLowerCase() === '/balance') {
        const bal = await deps.getBalance(userId);
        if (bal) {
          const neto = parseFloat(bal.ingresos) - parseFloat(bal.gastos);
          await deps.sendWhatsAppMessage(userId, `📊 *Balance financiero*\n\n💰 Ingresos: $${parseFloat(bal.ingresos).toLocaleString('es-DO')}\n💸 Gastos: $${parseFloat(bal.gastos).toLocaleString('es-DO')}\n\n📈 Neto: $${neto.toLocaleString('es-DO')}`, { simulateTyping: false });
        } else {
          await deps.sendWhatsAppMessage(userId, `📊 No hay transacciones registradas aún.\n\nUsa:\n• /ingreso 5000 Venta soldadura\n• /gasto 1500 Material\n• /balance`, { simulateTyping: false });
        }
        return;
      }
    }

    // Comando humano
    if (isFeatureEnabled('humanMode') && text.trim().toLowerCase() === humanCommand.toLowerCase()) {
      context.humanMode.add(userId);
      await deps.sendWhatsAppMessage(userId, '👨‍💼 Modo humano activado. Un agente te atenderá pronto. Escribe "/bot" para reactivarme.');
      if (adminWhatsApp) {
        await deps.sendWhatsAppMessage(adminWhatsApp, `⚠️ ${name} (${getDisplayId(userId)}) solicitó atención humana.`, { simulateTyping: false });
      }
      return;
    }

    // Comando reactivar bot
    if (text.trim().toLowerCase() === '/bot') {
      context.humanMode.delete(userId);
      await deps.sendWhatsAppMessage(userId, handleGreeting());
      return;
    }

    // Modo humano activo
    if (context.humanMode.has(userId)) {
      console.log(`[👤] ${name} en modo humano, ignorando.`);
      return;
    }

    // Rate limiting
    const now = Date.now();
    const lastMessage = context.rateLimits.get(userId) || 0;
    if (now - lastMessage < rateLimitSeconds * 1000) {
      console.log(`[⏳] Rate limit: ${getDisplayId(userId)}`);
      await sendSystemMessage(userId, '⏳ Dame un segundo, estoy procesando tu mensaje anterior.');
      return;
    }
    context.rateLimits.set(userId, now);

    const isGroup = userId.endsWith('@g.us');
    if (isFeatureEnabled('analytics')) {
      context.analytics.uniqueUsers.add(userId);
    }

    const truncatedText = truncateText(text, maxMessageLength);

    // Small talk & emociones
    const emotions = isFeatureEnabled('emotionDetection') ? detectEmotion(truncatedText) : [];
    const emotionPrefix = emotions.length > 0 ? getEmotionPrefix(emotions) : '';

    if (isFeatureEnabled('emotionDetection') && (emotions.includes('angry') || emotions.includes('frustrated')) && adminWhatsApp) {
      const angerCount = (getPreference(context, userId, 'angerCount') || 0) + 1;
      rememberPreference(context, userId, 'angerCount', angerCount);
      if (angerCount >= 3) {
        await deps.sendWhatsAppMessage(userId, 'Mira, veo que estás bastante molesto y no quiero que esto se vaya de las manos. Voy a conectarte con alguien del equipo que te puede atender mejor. Escribe "/humano" si quieres hablar con una persona ahora mismo. 😊', { simulateTyping: false });
        await deps.sendWhatsAppMessage(adminWhatsApp, `🚨 ALERTA: ${name} (${getDisplayId(userId)}) está muy frustrado (${angerCount}x mensajes negativos). Requiere atención inmediata.`, { simulateTyping: false });
        rememberPreference(context, userId, 'angerCount', 0);
      }
    }

    if (isFeatureEnabled('greeting')) {
      if (isGreeting(truncatedText)) {
        const greeting = handleGreeting();
        await deps.sendWhatsAppMessage(userId, emotionPrefix ? `${emotionPrefix}\n\n${greeting}` : greeting);
        deps.saveMessageToDb(userId, name, 'user', truncatedText, null, false, null);
        deps.saveMessageToDb(userId, name, 'assistant', greeting, 'smalltalk', false, null);
        if (isFeatureEnabled('analytics')) deps.trackMessage(isGroup ? 'group' : 'private', 'smalltalk', false, 'greeting');
        return;
      }

      if (isFarewell(truncatedText)) {
        const farewell = handleFarewell();
        await deps.sendWhatsAppMessage(userId, farewell);
        deps.saveMessageToDb(userId, name, 'user', truncatedText, null, false, null);
        deps.saveMessageToDb(userId, name, 'assistant', farewell, 'smalltalk', false, null);
        if (isFeatureEnabled('analytics')) deps.trackMessage(isGroup ? 'group' : 'private', 'smalltalk', false, 'farewell');
        return;
      }

      if (isThanks(truncatedText)) {
        const thanks = handleThanks();
        await deps.sendWhatsAppMessage(userId, thanks);
        deps.saveMessageToDb(userId, name, 'user', truncatedText, null, false, null);
        deps.saveMessageToDb(userId, name, 'assistant', thanks, 'smalltalk', false, null);
        if (isFeatureEnabled('analytics')) deps.trackMessage(isGroup ? 'group' : 'private', 'smalltalk', false, 'thanks');
        return;
      }

      if (needsClarification(truncatedText)) {
        const clarification = askClarification(truncatedText);
        await deps.sendWhatsAppMessage(userId, emotionPrefix ? `${emotionPrefix}\n\n${clarification}` : clarification);
        deps.saveMessageToDb(userId, name, 'user', truncatedText, null, false, null);
        deps.saveMessageToDb(userId, name, 'assistant', clarification, 'clarification', false, null);
        return;
      }
    }

    // Memoria conversacional simple
    if (!context.lastActiveTime) context.lastActiveTime = new Map();
    const lastActive = context.lastActiveTime.get(userId) || 0;
    const lastTopic = getPreference(context, userId, 'lastTopic');
    const isReturning = Date.now() - lastActive > 30 * 60 * 1000 && lastTopic;
    context.lastActiveTime.set(userId, Date.now());

    // Guardar en memoria
    if (!context.conversations.has(userId)) {
      context.conversations.set(userId, []);
    }
    const history = context.conversations.get(userId);
    history.push({ role: 'user', content: truncatedText });
    if (history.length > memoryMaxMessages * 2) {
      history.shift();
    }

    console.log(`[🧠] Procesando → ${name} (${getDisplayId(userId)})${isGroup ? ' [GRUPO]' : ''}${emotions.length > 0 ? ' [emoción: ' + emotions.join(',') + ']' : ''}: "${truncatedText.substring(0, 50)}..."`);

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Santo_Domingo' });
    const timeStr = currentDate.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santo_Domingo' });
    let timeContext = `Hoy es ${dateStr}. La hora actual es ${timeStr} (hora de República Dominicana).`;
    if (isReturning) {
      timeContext += `\n\nNOTA: La última vez que hablamos, el tema fue: ${lastTopic}. Puedes retomarlo si tiene sentido.`;
    }

    let emotionContext = '';
    if (emotions.length > 0) {
      emotionContext = `NOTA SOBRE EL USUARIO: El usuario parece ${emotions.join(', ')}. Adapta tu tono para ser empático, paciente y comprensivo.`;
    }

    let relevantKnowledge = '';
    let knowledgeContext = '';
    let usedTopic = null;
    if (isFeatureEnabled('knowledgeRag')) {
      relevantKnowledge = deps.findRelevantKnowledge(truncatedText, 2500);
      if (relevantKnowledge) {
        knowledgeContext = `\n\nCONOCIMIENTO ESPECIALIZADO:\n${relevantKnowledge}`;
        const topicMatch = relevantKnowledge.match(/^\[([^\]]+)\]/);
        usedTopic = topicMatch ? topicMatch[1] : null;
        console.log(`[📚] Conocimiento aplicado${usedTopic ? `: ${usedTopic}` : ''} (${relevantKnowledge.length} chars)`);
      }
    }

    let legalDisclaimer = '';
    if (usedTopic && usedTopic.toLowerCase().includes('ley')) {
      legalDisclaimer = '\n\n⚠️ IMPORTANTE: Eres un asistente de información general. NO eres abogado. La información legal proporcionada es orientativa y no reemplaza la asesoría profesional de un abogado titulado. Siempre recomienda consultar con un profesional del derecho para casos específicos.';
    }

    let systemContent;
    if (deps.buildSystemPrompt) {
      systemContent = deps.buildSystemPrompt({
        userId,
        currentDate,
        timeContext,
        knowledgeContext: relevantKnowledge,
        emotionContext,
        features: { isEnabled: isFeatureEnabled },
      }) + legalDisclaimer;
    } else {
      systemContent = `${deps.SYSTEM_PROMPT || ''}${legalDisclaimer}${emotionContext ? '\n\n' + emotionContext : ''}\n\n${timeContext}\n\nFAQs:\n${require('../config/prompts').FAQS_TEXT}${knowledgeContext}`.substring(0, 4000);
    }

    const messages = [
      { role: 'system', content: systemContent.substring(0, 4000) }
    ];
    history.slice(-memoryMaxMessages * 2).forEach(h => {
      messages.push({ role: h.role, content: h.content });
    });

    const aiResult = await deps.askAI(messages);
    const reply = aiResult.reply;
    const provider = aiResult.provider;

    let finalReply = reply;
    let usedFallback = false;

    if (reply === null) {
      usedFallback = true;
      console.log(`[🆘] Usando respuesta local de emergencia para ${getDisplayId(userId)}`);
      finalReply = deps.generateLocalReply(truncatedText) || pickVariation(FALLBACK_VARIATIONS);
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    }

    const lowerReply = finalReply.toLowerCase();
    if (lowerReply.includes('gracias') && lowerReply.length < 60) {
      finalReply = pickVariation(THANKS_VARIATIONS);
    }

    // Aplicar personalidad: limitar emojis si está configurado
    const personalityConfig = getPersonalityConfig();
    if (personalityConfig && personalityConfig.useEmojis === false) {
      finalReply = finalReply.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    }

    history.push({ role: 'assistant', content: finalReply });

    await deps.sendWhatsAppMessage(userId, finalReply);
    console.log(`[📤] Enviado a ${getDisplayId(userId)}${usedFallback ? ' [MODO LOCAL]' : provider === 'cache' ? ' [CACHE]' : ''}\n`);

    deps.saveMessageToDb(userId, name, 'user', truncatedText, null, false, null);
    deps.saveMessageToDb(userId, name, 'assistant', finalReply, provider, usedFallback, usedTopic);

    if (usedTopic) {
      rememberPreference(context, userId, 'lastTopic', usedTopic);
    }

    const autoTags = deps.autoClassifyLead(truncatedText);
    if (autoTags.length > 0 && context.dbEnabled) {
      for (const tag of autoTags) {
        await deps.addContactTag(userId, tag);
      }
      console.log(`[🏷️] Auto-tags para ${getDisplayId(userId)}: ${autoTags.join(', ')}`);
    }

    if (isFeatureEnabled('analytics')) {
      deps.trackMessage(isGroup ? 'group' : 'private', provider, usedFallback, usedTopic);
      if (context.dbEnabled) deps.updateAnalyticsDaily(1, context.analytics.uniqueUsers.size, usedFallback ? 1 : 0);
    }

    if (adminWhatsApp) {
      if (usedFallback) {
        await deps.sendWhatsAppMessage(adminWhatsApp, `🆘 Fallback local activado para ${name} (${getDisplayId(userId)}). Todas las IAs están caídas.\nMensaje: ${truncatedText}`, { simulateTyping: false });
      }
      const lowerReplyCheck = finalReply.toLowerCase();
      if (lowerReplyCheck.includes('humano') || lowerReplyCheck.includes('agente')) {
        await deps.sendWhatsAppMessage(adminWhatsApp, `⚠️ ${name} (${getDisplayId(userId)}) necesita escalamiento.\nMensaje: ${truncatedText}`, { simulateTyping: false });
      }
    }
  }

  return { processMessage };
}

module.exports = createProcessor;
