// Recibe el pedido de saludo desde content-panel.js, guarda los datos para que
// content-whatsapp.js los lea, y abre el chat del empleado reutilizando una
// pestaña de WhatsApp Web ya abierta si existe (en vez de abrir una nueva).
chrome.runtime.onMessage.addListener((mensaje) => {
  if (!mensaje || mensaje.type !== 'saludoWhatsapp') return;
  const { numero, texto, imagenDataUrl, nombre } = mensaje.payload || {};
  if (!numero || !imagenDataUrl) return;

  chrome.storage.local.set(
    { pendienteSaludo: { numero, texto, imagenDataUrl, nombre, ts: Date.now() } },
    () => {
      const url = `https://web.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(texto || '')}`;
      abrirOReusarPestanaWhatsapp(url);
    }
  );
});

function abrirOReusarPestanaWhatsapp(url) {
  chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      chrome.tabs.update(tab.id, { url, active: true });
      chrome.windows.update(tab.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url });
    }
  });
}
