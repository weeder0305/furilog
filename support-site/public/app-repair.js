(async () => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/app/');
    if (!registration) return;
    await registration.update();
    const worker = registration.installing || registration.waiting;
    if (!worker || worker.state === 'activated') return;
    await new Promise((resolve) => {
      const timeoutId = window.setTimeout(resolve, 15000);
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          window.clearTimeout(timeoutId);
          resolve();
        }
      });
    });
  } catch {
    // The support page remains usable even if a browser blocks service-worker updates.
  }
})();
