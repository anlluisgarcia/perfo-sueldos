# Extensión "Saludo Cumpleaños - Perfo Sueldos"

Extensión de Chrome que hace que, al apretar el ícono de WhatsApp del cumpleañero
del día en el panel, se reuse la pestaña de WhatsApp Web que ya tengas abierta
(si no hay ninguna, abre una) en el chat del empleado, con la tarjeta de
saludo (según su sexo, cargada en Configuración > Salutación) ya pegada en el
cuadro de mensaje. Solo queda apretar la flecha de Enviar.

## Aviso importante

Esto automatiza la interfaz de WhatsApp Web mediante un método no oficial
(simulando un pegado de imagen). **Esto va contra los Términos de Servicio de
WhatsApp** y existe el riesgo real de que Meta bloquee o banee el número de
WhatsApp de la empresa si lo detecta. Se construyó porque así se pidió
explícitamente, entendiendo ese riesgo. Si en algún momento se prefiere evitar
ese riesgo, la alternativa sin riesgo es no instalar esta extensión: el botón
sigue funcionando igual (copia la imagen al portapapeles y hay que pegarla con
Ctrl+V a mano).

## Instalación (modo desarrollador, no requiere subirla a la Chrome Web Store)

1. Abrir Chrome y entrar a `chrome://extensions`.
2. Activar el interruptor **"Modo de desarrollador"** (arriba a la derecha).
3. Click en **"Cargar descomprimida"** ("Load unpacked").
4. Seleccionar esta carpeta (`whatsapp-extension`).
5. Confirmar que aparece la extensión "Saludo Cumpleaños - Perfo Sueldos" en la lista, activada.

Hay que instalarla en cada computadora donde se vaya a usar esta función.

Si ya la habías instalado antes y se actualizaron estos archivos, entrá a
`chrome://extensions` y apretá el ícono de recargar (⟳) en la tarjeta de la
extensión para que tome los cambios — no hace falta desinstalarla y volver a
cargarla.

## Probarla

1. Entrar al panel (`https://sueldos.btzminera.com.ar`) y recargar la página
   (para que la extensión se inyecte).
2. Con algún empleado con cumpleaños hoy, sexo y celular cargados, y una imagen
   subida en Configuración > Salutación para ese sexo, apretar el ícono de
   WhatsApp.
3. Debería abrirse WhatsApp Web en el chat del empleado con la imagen ya
   puesta en el cuadro de mensaje (puede tardar unos segundos en aparecer
   mientras carga el chat). Si todo esta bien, solo queda apretar Enviar.

## Si no pega la imagen (selector desactualizado)

WhatsApp Web cambia su interfaz con el tiempo, así que el selector del cuadro
de mensaje que usa `content-whatsapp.js` puede quedar desactualizado. Si al
probar no aparece la imagen:

1. Abrir la consola de Chrome en la pestaña de WhatsApp Web (F12 → pestaña
   "Console") y ver si aparece un error de "Saludo Cumpleaños" indicando que
   no encontró el cuadro de mensaje.
2. Hacer clic derecho sobre el cuadro donde se escribe el mensaje en WhatsApp
   Web → "Inspeccionar".
3. Copiar el selector del elemento resaltado (atributo `aria-label`,
   `data-testid`, o similar) y agregarlo a la lista `SELECTORES_COMPOSE` en
   `content-whatsapp.js`.
4. Volver a `chrome://extensions` y apretar el ícono de recargar en la tarjeta
   de la extensión.
