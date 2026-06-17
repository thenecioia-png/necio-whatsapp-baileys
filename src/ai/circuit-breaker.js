function createCircuitBreaker(config, context) {
  const { circuitFailureThreshold, circuitResetMs } = config;

  function isCircuitOpen(provider) {
    const cb = context.circuitBreakers.get(provider);
    if (!cb) return false;
    if (cb.failures >= circuitFailureThreshold) {
      if (Date.now() - cb.lastFailure < circuitResetMs) {
        return true;
      }
      cb.failures = 0;
      cb.open = false;
    }
    return false;
  }

  function recordFailure(provider) {
    const cb = context.circuitBreakers.get(provider) || { failures: 0, lastFailure: 0, open: false };
    cb.failures++;
    cb.lastFailure = Date.now();
    if (cb.failures >= circuitFailureThreshold) {
      cb.open = true;
      console.log(`[⚡] Circuito ABIERTO para ${provider} (${circuitResetMs / 1000}s)`);
    }
    context.circuitBreakers.set(provider, cb);
  }

  function recordSuccess(provider) {
    context.circuitBreakers.set(provider, { failures: 0, lastFailure: 0, open: false });
  }

  function getCircuitStatus() {
    const status = {};
    for (const [name, cb] of context.circuitBreakers.entries()) {
      status[name] = { open: cb.open || isCircuitOpen(name), failures: cb.failures };
    }
    return status;
  }

  return { isCircuitOpen, recordFailure, recordSuccess, getCircuitStatus };
}

module.exports = createCircuitBreaker;
