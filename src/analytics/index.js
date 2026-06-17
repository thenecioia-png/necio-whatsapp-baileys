function createAnalytics(config, context, deps) {
  function resetDailyStats() {
    const today = new Date().toDateString();
    if (context.analytics.lastResetDate !== today) {
      context.analytics.messagesToday = 0;
      context.analytics.lastResetDate = today;
      console.log(`[📊] Stats diarias reiniciadas: ${today}`);
    }
  }

  function trackMessage(type = 'private', provider = null, usedFallback = false, topic = null) {
    resetDailyStats();
    context.analytics.messagesTotal++;
    context.analytics.messagesToday++;
    if (type === 'group') context.analytics.groupMessages++;
    else context.analytics.privateMessages++;
    if (provider) context.analytics.iaProviderUsage.set(provider, (context.analytics.iaProviderUsage.get(provider) || 0) + 1);
    if (usedFallback) context.analytics.fallbackCount++;
    if (topic) context.analytics.topicsUsed.set(topic, (context.analytics.topicsUsed.get(topic) || 0) + 1);
  }

  if (!config.disableTimers) {
    setInterval(resetDailyStats, 3600000);
  }

  return { resetDailyStats, trackMessage };
}

module.exports = createAnalytics;
