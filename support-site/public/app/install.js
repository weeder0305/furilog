const consent = document.querySelector('#consent');
const installButton = document.querySelector('#install');
const status = document.querySelector('#status');
const openApp = document.querySelector('#open-app');

function askWorker(worker, type, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timeoutId = window.setTimeout(() => reject(new Error('timeout')), timeout);
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeoutId);
      resolve(event.data);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

async function findActiveWorker() {
  const registration = await navigator.serviceWorker.getRegistration('/app/');
  return registration?.active || null;
}

function waitForActivation(worker) {
  if (!worker || worker.state === 'activated') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error('activation timeout')), 15000);
    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        window.clearTimeout(timeoutId);
        resolve();
      }
    });
  });
}

async function showExistingInstall() {
  if (!('serviceWorker' in navigator)) {
    status.textContent = '現在の利用環境はオフライン保存に対応していません。OS標準または普段お使いのブラウザを最新版へ更新してお試しください。';
    consent.disabled = true;
    return;
  }
  const worker = await findActiveWorker();
  if (!worker) return;
  const result = await askWorker(worker, 'FURILOG_OFFLINE_STATUS', 3000);
  if (result?.installed) {
    status.textContent = 'この端末への保存は完了しています。';
    consent.closest('label').hidden = true;
    installButton.hidden = true;
    openApp.hidden = false;
  }
}

consent.addEventListener('change', () => {
  installButton.disabled = !consent.checked;
  status.textContent = consent.checked
    ? 'ボタンを押すと、アプリ一式のダウンロードを開始します。'
    : '同意するまでダウンロードは始まりません。';
});

installButton.addEventListener('click', async () => {
  if (!consent.checked || !('serviceWorker' in navigator)) return;
  installButton.disabled = true;
  consent.disabled = true;
  status.textContent = 'アプリ一式を端末に保存しています。画面を閉じずにお待ちください…';
  try {
    const registration = await navigator.serviceWorker.register('/app/sw.js', { scope: '/app/' });
    await registration.update();
    await waitForActivation(registration.installing || registration.waiting);
    const worker = registration.active || await findActiveWorker();
    if (!worker) throw new Error('worker unavailable');
    const result = await askWorker(worker, 'FURILOG_INSTALL_OFFLINE');
    if (!result?.ok) throw new Error('cache failed');
    try {
      localStorage.setItem('furilog:offline-consent', JSON.stringify({ agreedAt: new Date().toISOString() }));
    } catch {
      // The offline cache is already complete; private browsing may block this optional receipt.
    }
    status.textContent = '保存が完了しました。これ以降、ふりろぐはオフラインで使えます。';
    installButton.hidden = true;
    consent.closest('label').hidden = true;
    openApp.hidden = false;
  } catch {
    status.textContent = '保存に失敗しました。通信状態と空き容量を確認して、もう一度お試しください。';
    installButton.disabled = false;
    consent.disabled = false;
  }
});

showExistingInstall().catch(() => undefined);
