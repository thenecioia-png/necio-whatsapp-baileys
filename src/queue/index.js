function createQueue(config, context, deps) {
  async function processQueue() {
    if (context.isProcessing || context.messageQueue.length === 0) return;
    context.isProcessing = true;

    const { userId, name, text } = context.messageQueue.shift();
    try {
      await deps.processMessage(userId, name, text);
    } catch (err) {
      console.error('[!] Error procesando mensaje:', err.message);
    }

    context.isProcessing = false;
    if (context.messageQueue.length > 0) {
      setImmediate(processQueue);
    }
  }

  function enqueueMessage(userId, name, text) {
    context.messageQueue.push({ userId, name, text });
    processQueue();
  }

  return { processQueue, enqueueMessage };
}

module.exports = createQueue;
