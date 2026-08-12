// Se inyecta en web.whatsapp.com. Si hay un saludo pendiente guardado por
// content-panel.js, espera a que aparezca el cuadro de mensaje del chat y
// simula un "pegado" (paste) de la imagen, tal como si el usuario hubiera
// hecho Ctrl+V. Deja el texto para que WhatsApp lo tome del parametro
// ?text= de la URL (eso ya lo resuelve WhatsApp Web solo, no hace falta
// tocarlo aca) y el envio final queda para que el usuario apriete la flecha.
//
// IMPORTANTE: los selectores de SELECTORES_COMPOSE son los conocidos al
// momento de escribir esto. WhatsApp Web cambia su interfaz seguido: si deja
// de pegar la imagen, hay que inspeccionar (F12) el cuadro de mensaje real y
// agregar el selector nuevo a esta lista.
(function () {
  const TIMEOUT_ESPERA_MS = 20000;
  const VENTANA_VALIDEZ_MS = 90 * 1000;

  const SELECTORES_COMPOSE = [
    'div[aria-label="Escribe un mensaje"][contenteditable="true"]',
    'div[aria-label="Escriba un mensaje"][contenteditable="true"]',
    'div[data-testid="conversation-compose-box-input"]',
    'footer div[contenteditable="true"]'
  ];

  function numeroDeUrl() {
    try {
      return new URLSearchParams(location.search).get('phone') || '';
    } catch {
      return '';
    }
  }

  function buscarCompose() {
    for (const selector of SELECTORES_COMPOSE) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function esperarCompose(timeoutMs) {
    return new Promise((resolve, reject) => {
      const existente = buscarCompose();
      if (existente) return resolve(existente);
      const obs = new MutationObserver(() => {
        const el = buscarCompose();
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        reject(new Error('No se encontro el cuadro de mensaje de WhatsApp Web (selector desactualizado)'));
      }, timeoutMs);
    });
  }

  function dataUrlAFile(dataUrl, nombreArchivo) {
    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = /data:(.*);base64/.exec(meta);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], nombreArchivo, { type: mime });
  }

  async function pegarImagen(pendiente) {
    const compose = await esperarCompose(TIMEOUT_ESPERA_MS);
    const archivo = dataUrlAFile(
      pendiente.imagenDataUrl,
      `saludo-${(pendiente.nombre || 'cumple').replace(/[^a-zA-Z0-9]+/g, '_')}.png`
    );
    const dt = new DataTransfer();
    dt.items.add(archivo);
    compose.focus();
    const eventoPaste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
    compose.dispatchEvent(eventoPaste);
  }

  chrome.storage.local.get('pendienteSaludo', ({ pendienteSaludo }) => {
    if (!pendienteSaludo) return;
    if (Date.now() - pendienteSaludo.ts > VENTANA_VALIDEZ_MS) {
      chrome.storage.local.remove('pendienteSaludo');
      return;
    }
    const numeroUrl = numeroDeUrl();
    if (numeroUrl && pendienteSaludo.numero && numeroUrl !== pendienteSaludo.numero) return;

    pegarImagen(pendienteSaludo)
      .catch(err => console.error('[Saludo Cumpleaños] No se pudo pegar la imagen automaticamente:', err))
      .finally(() => chrome.storage.local.remove('pendienteSaludo'));
  });
})();
