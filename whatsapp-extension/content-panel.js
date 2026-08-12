// Se inyecta en el panel de Perfo Sueldos (sueldos.btzminera.com.ar). Marca en
// el HTML que la extension esta instalada (asi app.js sabe que puede delegarle
// el pegado automatico) y guarda en chrome.storage.local los datos del saludo
// cuando el panel dispara el evento "perfoSaludoWhatsapp".
document.documentElement.setAttribute('data-saludo-whatsapp-ext', '1');

window.addEventListener('perfoSaludoWhatsapp', (evento) => {
  const detalle = evento.detail || {};
  if (!detalle.numero || !detalle.imagenDataUrl) return;
  chrome.storage.local.set({
    pendienteSaludo: {
      numero: detalle.numero,
      texto: detalle.texto || '',
      imagenDataUrl: detalle.imagenDataUrl,
      nombre: detalle.nombre || '',
      ts: Date.now()
    }
  });
});
