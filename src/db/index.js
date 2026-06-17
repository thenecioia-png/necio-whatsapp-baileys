const { safeReadJSON, safeWriteJSON } = require('../utils/files');

function createDb(config, context) {
  const { supabaseUrl, supabaseKey, persistMemory, memoryFile } = config;

  async function initDatabase() {
    if (!supabaseUrl || !supabaseKey) return false;
    try {
      const { createClient } = require('@supabase/supabase-js');
      context.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
      const { error } = await context.supabase.from('conversations').select('id', { count: 'exact', head: true });
      if (error && error.code !== '42P01') {
        console.error('[!] Supabase error:', error.message);
        return false;
      }
      context.dbEnabled = true;
      console.log('[🐘] Supabase conectado');
      return true;
    } catch (e) {
      console.error('[!] Supabase no disponible:', e.message);
      context.dbEnabled = false;
      context.supabase = null;
      return false;
    }
  }

  function loadConversations() {
    if (!persistMemory) return;
    try {
      const data = safeReadJSON(memoryFile, {});
      context.conversations = new Map(Object.entries(data));
      console.log(`[💾] Memoria cargada: ${context.conversations.size} conversaciones`);
    } catch (e) {
      console.error('[!] Error cargando memoria:', e.message);
    }
  }

  async function saveConversations() {
    if (!persistMemory) return;
    try {
      await safeWriteJSON(memoryFile, Object.fromEntries(context.conversations));
    } catch (e) {
      console.error('[!] Error guardando memoria:', e.message);
    }
  }

  async function saveMessageToDb(phone, name, role, content, provider, usedFallback, usedTopic) {
    if (!context.dbEnabled || !context.supabase) return;
    try {
      await context.supabase.from('conversations').insert({
        phone,
        role,
        content: content.substring(0, 2000),
        provider: provider || null,
        used_fallback: !!usedFallback,
        used_topic: usedTopic || null
      });
      const { data: existing } = await context.supabase.from('contacts').select('message_count').eq('phone', phone).single();
      if (existing) {
        await context.supabase.from('contacts').update({
          name: name || existing.name,
          last_seen: new Date().toISOString(),
          message_count: (existing.message_count || 0) + 1
        }).eq('phone', phone);
      } else {
        await context.supabase.from('contacts').insert({
          phone,
          name: name || null,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          message_count: 1
        });
      }
    } catch (e) {
      console.error('[!] Error guardando en Supabase:', e.message);
    }
  }

  async function getContactHistory(phone, limit = 10) {
    if (!context.dbEnabled || !context.supabase) return [];
    try {
      const { data, error } = await context.supabase
        .from('conversations')
        .select('role, content, created_at')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return [];
      return (data || []).reverse();
    } catch (e) {
      return [];
    }
  }

  async function saveTransaction(phone, type, amount, description, category) {
    if (!context.dbEnabled || !context.supabase) return false;
    try {
      await context.supabase.from('transactions').insert({
        phone,
        type,
        amount,
        description: description || null,
        category: category || null
      });
      return true;
    } catch (e) {
      console.error('[!] Error guardando transacción:', e.message);
      return false;
    }
  }

  async function getBalance(phone) {
    if (!context.dbEnabled || !context.supabase) return null;
    try {
      const { data: ingresos } = await context.supabase
        .from('transactions')
        .select('amount')
        .eq('phone', phone)
        .eq('type', 'ingreso');
      const { data: gastos } = await context.supabase
        .from('transactions')
        .select('amount')
        .eq('phone', phone)
        .eq('type', 'gasto');
      const totalIngresos = (ingresos || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const totalGastos = (gastos || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      return { ingresos: totalIngresos, gastos: totalGastos };
    } catch (e) {
      return null;
    }
  }

  async function updateAnalyticsDaily(messagesDelta, usersDelta, fallbackDelta) {
    if (!context.dbEnabled || !context.supabase) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await context.supabase.from('analytics').select('*').eq('date', today).single();
      if (existing) {
        await context.supabase.from('analytics').update({
          messages: (existing.messages || 0) + messagesDelta,
          unique_users: Math.max(existing.unique_users || 0, usersDelta),
          fallback_count: (existing.fallback_count || 0) + fallbackDelta
        }).eq('date', today);
      } else {
        await context.supabase.from('analytics').insert({
          date: today,
          messages: messagesDelta,
          unique_users: usersDelta,
          fallback_count: fallbackDelta
        });
      }
    } catch (e) {
      console.error('[!] Error actualizando analytics:', e.message);
    }
  }

  // CRM helpers
  async function updateContactStatus(phone, status) {
    if (!context.dbEnabled || !context.supabase) return false;
    try {
      await context.supabase.from('contacts').update(status ? { status } : {}).eq('phone', phone);
      return true;
    } catch (e) {
      console.error('[!] Error actualizando estado:', e.message);
      return false;
    }
  }

  async function addContactTag(phone, tag) {
    if (!context.dbEnabled || !context.supabase) return false;
    try {
      const { data: contact } = await context.supabase.from('contacts').select('tags').eq('phone', phone).single();
      const currentTags = contact?.tags || [];
      if (!currentTags.includes(tag)) {
        await context.supabase.from('contacts').update({ tags: [...currentTags, tag] }).eq('phone', phone);
      }
      return true;
    } catch (e) {
      console.error('[!] Error agregando etiqueta:', e.message);
      return false;
    }
  }

  async function getContact(phone) {
    if (!context.dbEnabled || !context.supabase) return null;
    try {
      const { data } = await context.supabase.from('contacts').select('*').eq('phone', phone).single();
      return data;
    } catch (e) {
      return null;
    }
  }

  async function listContacts(status = null, limit = 50) {
    if (!context.dbEnabled || !context.supabase) return [];
    try {
      let query = context.supabase.from('contacts').select('*').order('last_seen', { ascending: false }).limit(limit);
      if (status) query = query.eq('status', status);
      const { data } = await query;
      return data || [];
    } catch (e) {
      return [];
    }
  }

  function autoClassifyLead(text) {
    const lower = text.toLowerCase();
    const tags = [];

    const hotWords = ['comprar', 'quiero', 'necesito', 'urgente', 'hoy', 'ya', 'precio', 'cotizar', 'cotización', 'cuanto cuesta', 'cuánto cuesta', 'presupuesto', 'orden', 'encargar'];
    const warmWords = ['información', 'info', 'dime', 'cuéntame', 'cómo funciona', 'que incluye', 'que ofrecen', 'servicios', 'opciones'];
    const coldWords = ['hola', 'buenas', 'saludos', 'que tal', 'buen dia', 'buenos dias'];

    const hasHot = hotWords.some(w => lower.includes(w));
    const hasWarm = warmWords.some(w => lower.includes(w));
    const hasCold = coldWords.some(w => lower.includes(w));

    if (hasHot) tags.push('lead_caliente');
    else if (hasWarm) tags.push('lead_tibio');
    else if (hasCold && text.length < 30) tags.push('lead_frio');

    if (/\b(soldadura|soldar|electrodo|mig|tig)\b/.test(lower)) tags.push('interes_soldadura');
    if (/\b(web|página|pagina|sitio|landing|ecommerce|tienda online)\b/.test(lower)) tags.push('interes_web');
    if (/\b(construcción|construccion|estructura|concreto|acero)\b/.test(lower)) tags.push('interes_construccion');
    if (/\b(herrería|herreria|puerta|ventana|portón|porton)\b/.test(lower)) tags.push('interes_herreria');
    if (/\b(legal|ley|contrato|abogado|demanda|juicio)\b/.test(lower)) tags.push('interes_legal');
    if (/\b(contable|contabilidad|impuesto|itbis|dgii|factura)\b/.test(lower)) tags.push('interes_contable');

    return tags;
  }

  if (persistMemory) {
    setInterval(() => saveConversations().catch(() => {}), 30000);
  }

  return {
    initDatabase,
    loadConversations,
    saveConversations,
    saveMessageToDb,
    getContactHistory,
    saveTransaction,
    getBalance,
    updateAnalyticsDaily,
    updateContactStatus,
    addContactTag,
    getContact,
    listContacts,
    autoClassifyLead,
  };
}

module.exports = createDb;
