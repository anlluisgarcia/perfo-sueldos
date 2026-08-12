// Se inyecta en el panel de Perfo Sueldos (sueldos.btzminera.com.ar). Marca en
// el HTML que la extension esta instalada (asi app.js sabe que puede delegarle
// el pegado automatico) y le avisa a background.js cuando el panel dispara el
// evento "perfoSaludoWhatsapp", para que abra (o reuse) la pestaña de
// WhatsApp Web correspondiente.
document.documentElement.setAttribute('data-saludo-whatsapp-ext', '1');

window.addEventListener('perfoSaludoWhatsapp', (evento) => {
  const detalle = evento.detail || {};
  if (!detalle.numero || !detalle.imagenDataUrl) return;
  chrome.runtime.sendMessage({ type: 'saludoWhatsapp', payload: detalle });
});
