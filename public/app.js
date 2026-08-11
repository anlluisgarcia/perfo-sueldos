const API = '';
let token = '';
let userRole = '';
let empleadosCache = [];

// ==================== CATALOGOS ====================
// Los usan tanto el formulario del empleado como la ficha que edita el admin.

// Van en MAYUSCULA para que coincidan con como el servidor guarda los datos.
// Argentina va primero por ser el caso mas frecuente; el resto en orden alfabetico.
const PAISES_AMERICA = [
  'ARGENTINA', 'ANTIGUA Y BARBUDA', 'BAHAMAS', 'BARBADOS', 'BELICE', 'BOLIVIA', 'BRASIL',
  'CANADÁ', 'CHILE', 'COLOMBIA', 'COSTA RICA', 'CUBA', 'DOMINICA', 'ECUADOR',
  'EL SALVADOR', 'ESTADOS UNIDOS', 'GRANADA', 'GUATEMALA', 'GUYANA', 'HAITÍ', 'HONDURAS',
  'JAMAICA', 'MÉXICO', 'NICARAGUA', 'PANAMÁ', 'PARAGUAY', 'PERÚ',
  'REPÚBLICA DOMINICANA', 'SAN CRISTÓBAL Y NIEVES', 'SAN VICENTE Y LAS GRANADINAS',
  'SANTA LUCÍA', 'SURINAM', 'TRINIDAD Y TOBAGO', 'URUGUAY', 'VENEZUELA'
];

const PROVINCIAS_ARG = [
  'BUENOS AIRES', 'CIUDAD AUTÓNOMA DE BUENOS AIRES', 'CATAMARCA', 'CHACO', 'CHUBUT',
  'CÓRDOBA', 'CORRIENTES', 'ENTRE RÍOS', 'FORMOSA', 'JUJUY', 'LA PAMPA', 'LA RIOJA',
  'MENDOZA', 'MISIONES', 'NEUQUÉN', 'RÍO NEGRO', 'SALTA', 'SAN JUAN', 'SAN LUIS',
  'SANTA CRUZ', 'SANTA FE', 'SANTIAGO DEL ESTERO', 'TIERRA DEL FUEGO', 'TUCUMÁN'
];

const GRUPOS_SANGUINEOS = ['0-', '0+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

const NIVELES_ESTUDIO = [
  'PRIMARIO', 'SECUNDARIO INCOMPLETO', 'SECUNDARIO COMPLETO',
  'TERCIARIO COMPLETO', 'UNIVERSITARIO COMPLETO'
];

// Categorias de la licencia nacional de conducir (Ley 24.449 / CENAT).
// Las clases C, D y E son profesionales.
const CLASES_CARNET = [
  { grupo: 'Clase A - Motovehículos', items: [
    { valor: 'A1.1', texto: 'A1.1 - Ciclomotores hasta 50 cc, transmisión automática' },
    { valor: 'A1.2', texto: 'A1.2 - Ciclomotores hasta 50 cc' },
    { valor: 'A1.3', texto: 'A1.3 - Motocicletas hasta 150 cc' },
    { valor: 'A1.4', texto: 'A1.4 - Motocicletas hasta 300 cc' },
    { valor: 'A2.1', texto: 'A2.1 - Motocicletas hasta 400 cc' },
    { valor: 'A2.2', texto: 'A2.2 - Motocicletas de más de 400 cc' },
    { valor: 'A3', texto: 'A3 - Triciclos y cuatriciclos motorizados' }
  ]},
  { grupo: 'Clase B - Automóviles y camionetas', items: [
    { valor: 'B1', texto: 'B1 - Automóviles, utilitarios, camionetas y casas rodantes hasta 3.500 kg' },
    { valor: 'B2', texto: 'B2 - B1 con acoplado de hasta 750 kg o casa rodante' }
  ]},
  { grupo: 'Clase C - Camiones (Profesional)', items: [
    { valor: 'C1', texto: 'C1 - Camiones sin acoplado ni semirremolque hasta 12.000 kg' },
    { valor: 'C2', texto: 'C2 - Camiones sin acoplado ni semirremolque de más de 12.000 kg' },
    { valor: 'C3', texto: 'C3 - Camiones con acoplado' }
  ]},
  { grupo: 'Clase D - Transporte de pasajeros y servicios (Profesional)', items: [
    { valor: 'D1', texto: 'D1 - Transporte de pasajeros hasta 8 plazas (taxi, remis, escolar, ambulancia)' },
    { valor: 'D2.1', texto: 'D2.1 - Transporte de pasajeros hasta 20 plazas' },
    { valor: 'D2.2', texto: 'D2.2 - Transporte de pasajeros de 21 a 35 plazas' },
    { valor: 'D2.3', texto: 'D2.3 - Transporte de pasajeros de más de 35 plazas' },
    { valor: 'D3', texto: 'D3 - Servicios de emergencia y seguridad' },
    { valor: 'D4', texto: 'D4 - Maquinaria especial no agrícola' }
  ]},
  { grupo: 'Clase E - Articulados y maquinaria especial (Profesional)', items: [
    { valor: 'E1', texto: 'E1 - Camiones articulados o con acoplado' },
    { valor: 'E2', texto: 'E2 - Maquinaria especial no agrícola' }
  ]},
  { grupo: 'Clase F - Vehículos adaptados', items: [
    { valor: 'F', texto: 'F - Vehículos adaptados para personas con discapacidad' }
  ]},
  { grupo: 'Clase G - Maquinaria agrícola', items: [
    { valor: 'G1', texto: 'G1 - Tractores agrícolas' },
    { valor: 'G2', texto: 'G2 - Maquinaria especial agrícola' },
    { valor: 'G3', texto: 'G3 - Tractores agrícolas con acoplado' }
  ]}
];

// Render compartido por el formulario del empleado y el del admin, que solo
// difieren en la clase CSS con la que despues se leen los tildados.
function checkboxesClasesHTML(claseCss, marcadas) {
  const seleccion = marcadas || [];
  let html = CLASES_CARNET.map(g => `
    <div class="clases-grupo">
      <span class="clases-grupo-titulo">${escAttr(g.grupo)}</span>
      <div class="checkbox-grid">
        ${g.items.map(c => `
          <label class="checkbox-item">
            <input type="checkbox" class="${claseCss}" value="${escAttr(c.valor)}"${seleccion.includes(c.valor) ? ' checked' : ''}>
            <span>${escAttr(c.texto)}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');

  // Las fichas cargadas con el listado anterior guardaron clases genericas (A, B,
  // C...). Se muestran tildadas aparte para no perder el dato al guardar de nuevo.
  const conocidas = CLASES_CARNET.flatMap(g => g.items.map(i => i.valor));
  const viejas = seleccion.filter(v => !conocidas.includes(v));
  if (viejas.length) {
    html += `
      <div class="clases-grupo">
        <span class="clases-grupo-titulo">Cargado con el listado anterior (actualizar)</span>
        <div class="checkbox-grid">
          ${viejas.map(v => `
            <label class="checkbox-item">
              <input type="checkbox" class="${claseCss}" value="${escAttr(v)}" checked>
              <span>${escAttr(v)}</span>
            </label>`).join('')}
        </div>
      </div>`;
  }
  return html;
}

const VALOR_OTRO = '__otro__';

// Los valores guardados antes de la regla de mayusculas siguen matcheando con las
// opciones de los selects gracias a esta normalizacion al leerlos.
function mayus(valor) {
  return (valor === null || valor === undefined) ? '' : String(valor).toUpperCase();
}

// ==================== UTILIDADES ====================
function escAttr(valor) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// Cuando el servidor responde HTML en vez de JSON (404 de Express porque quedo
// corriendo una version vieja, o un error de Passenger) el res.json() falla con un
// "Unexpected token '<'" que no le dice nada a nadie. Esto lo traduce.
async function leerJson(res) {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch {
    if (res.status === 404) {
      throw new Error('El servidor no reconoce esta funcion. Hay que reiniciar la aplicacion en el servidor para que tome la version nueva.');
    }
    throw new Error(`El servidor respondio de forma inesperada (HTTP ${res.status})`);
  }
}

function headers() {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function headersAuth() {
  return { 'Authorization': `Bearer ${token}` };
}

function formatFecha(fecha) {
  if (!fecha) return '-';
  // Periodos complementarios: 2024-SAC1 / 2024-SAC2
  const sac = fecha.match(/^(\d{4})-SAC([12])$/);
  if (sac) return `${sac[2]}° SAC ${sac[1]}`;
  const parts = fecha.split('-');
  if (parts.length >= 2) {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[parseInt(parts[1])-1]} ${parts[0]}`;
  }
  return fecha;
}

// ==================== PERIODOS (mensual / SAC) ====================
// Un periodo es "YYYY-MM" (mensual) o "YYYY-SAC1" / "YYYY-SAC2" (complementario).

function llenarSelectAnios(selectId, incluirTodos) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const actual = new Date().getFullYear();
  let opts = incluirTodos ? '<option value="">Todos los a&ntilde;os</option>' : '';
  for (let a = actual + 1; a >= actual - 10; a--) {
    opts += `<option value="${a}"${a === actual && !incluirTodos ? ' selected' : ''}>${a}</option>`;
  }
  sel.innerHTML = opts;
}

// prefix: 'recibo' o 'recibo-masivo'
function toggleTipoPeriodo(prefix) {
  const tipo = document.getElementById(`${prefix}-tipo`).value;
  const esSac = tipo !== 'mensual';
  document.getElementById(`grupo-${prefix}-mes`).classList.toggle('hidden', esSac);
  document.getElementById(`grupo-${prefix}-anio`).classList.toggle('hidden', !esSac);
}

function getPeriodoSeleccionado(prefix) {
  const tipo = document.getElementById(`${prefix}-tipo`).value;
  if (tipo === 'mensual') {
    return document.getElementById(`${prefix}-fecha`).value;
  }
  const anio = document.getElementById(`${prefix}-anio`).value;
  return anio ? `${anio}-${tipo}` : '';
}

// ==================== LOGIN ====================
function switchLoginTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'empleado') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('form-login-empleado').classList.remove('hidden');
    document.getElementById('form-login-admin').classList.add('hidden');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('form-login-empleado').classList.add('hidden');
    document.getElementById('form-login-admin').classList.remove('hidden');
  }
}

async function loginEmpleado(e) {
  e.preventDefault();
  const dni = document.getElementById('emp-dni').value.trim();
  const clave = document.getElementById('emp-clave').value;
  const errorEl = document.getElementById('error-empleado');
  errorEl.textContent = '';

  if (!dni || !clave) {
    errorEl.textContent = 'Complete todos los campos';
    return;
  }

  try {
    const res = await fetch(`${API}/api/empleado/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, clave })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    token = data.token;
    userRole = 'empleado';
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', 'empleado');
    localStorage.setItem('userName', data.nombre);
    document.getElementById('empleado-nombre').textContent = data.nombre;
    showScreen('empleado-screen');
    cargarRecibosEmpleado();
  } catch (err) {
    errorEl.textContent = err.message === 'Failed to fetch'
      ? 'No se pudo conectar al servidor'
      : err.message;
  }
}

async function loginAdmin(e) {
  e.preventDefault();
  const usuario = document.getElementById('admin-usuario').value.trim();
  const clave = document.getElementById('admin-clave').value;
  const errorEl = document.getElementById('error-admin');
  errorEl.textContent = '';

  if (!usuario || !clave) {
    errorEl.textContent = 'Complete todos los campos';
    return;
  }

  try {
    const res = await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, clave })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    token = data.token;
    userRole = 'admin';
    localStorage.setItem('token', token);
    localStorage.setItem('userRole', 'admin');
    localStorage.setItem('userName', data.nombre);
    localStorage.setItem('userPermiso', data.permiso || 'administrativo');
    document.getElementById('admin-nombre').textContent = data.nombre;
    showScreen('admin-screen');
    cargarDashboard();
  } catch (err) {
    errorEl.textContent = err.message === 'Failed to fetch'
      ? 'No se pudo conectar al servidor'
      : err.message;
  }
}

function logout() {
  token = '';
  userRole = '';
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('userPermiso');
  document.getElementById('emp-dni').value = '';
  document.getElementById('emp-clave').value = '';
  document.getElementById('admin-usuario').value = '';
  document.getElementById('admin-clave').value = '';
  showScreen('login-screen');
}

// ==================== ADMIN DASHBOARD ====================
async function cargarDashboard() {
  cargarEstadisticas();
  cargarEmpleados();
  cargarFirmasAdmin();
  cargarHistorialRecibos();
  verificarCumpleanios();

  // Ocultar tabs "Alta Usuario" y "Configuración" para operadores
  const permiso = localStorage.getItem('userPermiso');
  const tabUsuarios = document.querySelector('.admin-tab[onclick*="usuarios"]');
  const tabConfiguracion = document.querySelector('.admin-tab[onclick*="configuracion"]');
  if (permiso === 'operador') {
    if (tabUsuarios) tabUsuarios.style.display = 'none';
    if (tabConfiguracion) tabConfiguracion.style.display = 'none';
  } else {
    if (tabUsuarios) tabUsuarios.style.display = '';
    if (tabConfiguracion) tabConfiguracion.style.display = '';
  }
}

async function cargarEstadisticas() {
  try {
    const res = await fetch(`${API}/api/admin/estadisticas`, { headers: headersAuth() });
    const data = await res.json();
    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${data.totalEmpleados}</div>
        <div class="stat-label">Total Empleados</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.activos}</div>
        <div class="stat-label">Empleados Activos</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.inactivos}</div>
        <div class="stat-label">Empleados Inactivos</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${data.totalRecibos}</div>
        <div class="stat-label">Recibos Cargados</div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

// ==================== CUMPLEAÑOS ====================
async function verificarCumpleanios() {
  try {
    const res = await fetch(`${API}/api/admin/cumpleanios`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error);

    const hoy = data.hoy || [];
    const proximos = data.proximos || [];
    if (hoy.length === 0 && proximos.length === 0) return;

    let html = '';
    if (hoy.length > 0) {
      html += hoy.map(e => `<p class="cumple-hoy">&#127881; HOY CUMPLE ${e.nombre}</p>`).join('');
    }
    if (proximos.length > 0) {
      html += '<p class="cumple-proximos-titulo">Se aproxima el cumplea&ntilde;os de:</p>';
      html += '<ul class="cumple-proximos-lista">' + proximos.map(e =>
        `<li>${e.nombre} &mdash; ${formatFechaCorta(e.fecha_nacimiento)} (en ${e.dias} d&iacute;a${e.dias === 1 ? '' : 's'})</li>`
      ).join('') + '</ul>';
    }

    document.getElementById('modal-cumpleanios-cuerpo').innerHTML = html;
    document.getElementById('modal-cumpleanios').classList.remove('hidden');
  } catch (err) {
    console.error(err);
  }
}

function formatFechaCorta(fecha) {
  const partes = String(fecha || '').substring(0, 10).split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}` : '';
}

function cerrarModalCumpleanios() {
  document.getElementById('modal-cumpleanios').classList.add('hidden');
}

// ==================== ADMIN TABS ====================
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.admin-tab[onclick*="${tab}"]`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');

  if (tab === 'fichas') cargarFichas();
  if (tab === 'firmas') cargarFirmasAdmin();
  if (tab === 'recibos') cargarSelectEmpleados();
  if (tab === 'historial') cargarHistorialRecibos();
  if (tab === 'usuarios') cargarUsuarios();
}

// ==================== EMPLEADOS CRUD ====================
async function cargarEmpleados() {
  try {
    const res = await fetch(`${API}/api/admin/empleados`, { headers: headersAuth() });
    empleadosCache = await res.json();
    renderEmpleados(empleadosCache);
  } catch (err) {
    console.error(err);
  }
}

function renderEmpleados(empleados) {
  const tbody = document.getElementById('tabla-empleados');
  if (empleados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray-500);padding:40px">No hay empleados registrados</td></tr>';
    return;
  }
  tbody.innerHTML = empleados.map(emp => `
    <tr>
      <td><strong>${emp.nombre}</strong></td>
      <td>${emp.dni}</td>
      <td>${emp.empresa || '-'}</td>
      <td>${emp.telefono || '-'}</td>
      <td>${emp.direccion || '-'}</td>
      <td><span class="badge ${emp.estado === 'activo' ? 'badge-success' : 'badge-danger'}">${emp.estado}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editarFichaEmpleado(${emp.id})">Datos</button>
        <button class="btn btn-outline btn-sm" onclick="editarEmpleado(${emp.id})">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="confirmarEliminarEmpleado(${emp.id}, '${emp.nombre}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function filtrarEmpleados() {
  const q = document.getElementById('buscar-empleado').value.toLowerCase();
  const empresa = document.getElementById('filtro-empresa').value;
  const filtrados = empleadosCache.filter(e => {
    const coincideTexto = e.nombre.toLowerCase().includes(q) || e.dni.includes(q);
    const coincideEmpresa = !empresa || e.empresa === empresa;
    return coincideTexto && coincideEmpresa;
  });
  renderEmpleados(filtrados);
}

function mostrarFormEmpleado() {
  document.getElementById('form-empleado-container').classList.remove('hidden');
  document.getElementById('form-empleado-titulo').textContent = 'Nuevo Empleado';
  document.getElementById('form-empleado').reset();
  document.getElementById('emp-edit-id').value = '';
}

function cancelarFormEmpleado() {
  document.getElementById('form-empleado-container').classList.add('hidden');
}

function editarEmpleado(id) {
  const emp = empleadosCache.find(e => e.id === id);
  if (!emp) return;
  document.getElementById('form-empleado-container').classList.remove('hidden');
  document.getElementById('form-empleado-titulo').textContent = 'Editar Empleado';
  document.getElementById('emp-edit-id').value = emp.id;
  document.getElementById('emp-nombre').value = emp.nombre;
  document.getElementById('emp-dni-form').value = emp.dni;
  document.getElementById('emp-clave-form').value = '';
  document.getElementById('emp-telefono').value = emp.telefono || '';
  document.getElementById('emp-direccion').value = emp.direccion || '';
  document.getElementById('emp-empresa').value = emp.empresa || '';
  document.getElementById('emp-estado').value = emp.estado;
}

async function guardarEmpleado(e) {
  e.preventDefault();
  const id = document.getElementById('emp-edit-id').value;
  const data = {
    nombre: document.getElementById('emp-nombre').value.trim(),
    dni: document.getElementById('emp-dni-form').value.trim(),
    telefono: document.getElementById('emp-telefono').value.trim(),
    direccion: document.getElementById('emp-direccion').value.trim(),
    empresa: document.getElementById('emp-empresa').value,
    estado: document.getElementById('emp-estado').value
  };

  const claveVal = document.getElementById('emp-clave-form').value;
  if (claveVal) data.clave = claveVal;

  if (!data.nombre || !data.dni) {
    showToast('Nombre y DNI son obligatorios', 'error');
    return;
  }
  if (!id && !claveVal) {
    showToast('La clave es obligatoria para nuevos empleados', 'error');
    return;
  }

  try {
    const url = id ? `${API}/api/admin/empleados/${id}` : `${API}/api/admin/empleados`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: headers(),
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    showToast(result.message);
    cancelarFormEmpleado();
    cargarEmpleados();
    cargarEstadisticas();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmarEliminarEmpleado(id, nombre) {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('modal-titulo').textContent = 'Eliminar Empleado';
  document.getElementById('modal-mensaje').textContent = `¿Está seguro de eliminar a "${nombre}"? Se eliminarán también todos sus recibos.`;
  modal.classList.remove('hidden');
  document.getElementById('modal-confirmar').onclick = async () => {
    try {
      const res = await fetch(`${API}/api/admin/empleados/${id}`, {
        method: 'DELETE',
        headers: headersAuth()
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(result.message);
      cargarEmpleados();
      cargarEstadisticas();
    } catch (err) {
      showToast(err.message, 'error');
    }
    cerrarModal();
  };
}

function cerrarModal() {
  document.getElementById('modal-confirm').classList.add('hidden');
}

// ==================== ADMIN - FICHA DEL EMPLEADO ====================
// Una sola definicion de la ficha que alimenta el formulario de edicion y la vista
// de impresion. 't' es el tipo de control: text, email, date, number, select,
// paises (select de America + campo libre), clases (checkboxes) y textarea.

// Las calles del croquis se editan como campos comunes, pero en la impresion no se
// listan: se dibujan dentro del croquis, arriba de la firma.
const SECCION_CROQUIS = 'Croquis del domicilio';
const CAMPOS_CROQUIS = [
  { k: 'croquis_calle_1', l: 'Calle 1 (arriba)', t: 'text', max: 120 },
  { k: 'croquis_calle_2', l: 'Calle 2 (abajo)', t: 'text', max: 120 },
  { k: 'croquis_calle_3', l: 'Calle 3 (izquierda)', t: 'text', max: 120 },
  { k: 'croquis_calle_4', l: 'Calle 4 (derecha)', t: 'text', max: 120 }
];

const CAMPOS_FICHA = [
  ['Datos personales', [
    { k: 'apellidos', l: 'Apellidos', t: 'text', max: 150 },
    { k: 'nombres', l: 'Nombres', t: 'text', max: 150 },
    { k: 'email', l: 'Email', t: 'email', max: 150 },
    { k: 'estado_civil', l: 'Estado Civil', t: 'select', op: ['SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO'] },
    { k: 'dni', l: 'DNI', t: 'text', max: 8 },
    { k: 'cuit', l: 'CUIT', t: 'text', max: 20 },
    { k: 'fecha_nacimiento', l: 'Fecha de Nacimiento', t: 'date' },
    { k: 'sexo', l: 'Sexo', t: 'select', op: ['FEMENINO', 'MASCULINO', 'OTRO'] },
    { k: 'grupo_sanguineo', l: 'Grupo Sanguíneo', t: 'select', op: GRUPOS_SANGUINEOS },
    { k: 'nacionalidad', l: 'Nacionalidad', t: 'paises' }
  ]],
  ['Domicilio', [
    { k: 'domicilio', l: 'Domicilio', t: 'text', max: 200 },
    { k: 'localidad', l: 'Localidad', t: 'text', max: 120 },
    { k: 'codigo_postal', l: 'Código Postal', t: 'text', max: 20 },
    { k: 'provincia', l: 'Provincia', t: 'select', op: PROVINCIAS_ARG },
    { k: 'pais', l: 'País', t: 'paises' },
    { k: 'obra_social', l: 'Obra Social', t: 'select', op: ['SI', 'NO'] }
  ]],
  ['Carnet de conducir y estudios', [
    { k: 'carnet_conducir', l: 'Carnet de Conducción', t: 'select', op: ['SI', 'NO'] },
    { k: 'carnet_clases', l: 'Clases del carnet', t: 'clases', ancho: true },
    { k: 'carnet_vencimiento', l: 'Fecha Vencimiento', t: 'date', ancho: true },
    { k: 'carnet_comentario', l: 'Comentario', t: 'textarea', ancho: true },
    { k: 'nivel_estudio', l: 'Nivel de Estudio', t: 'select', op: NIVELES_ESTUDIO },
    { k: 'profesion', l: 'Profesión', t: 'text', max: 120 }
  ]],
  ['Grupo familiar', [
    { k: 'apellido_conyuge', l: 'Apellido del Cónyuge', t: 'text', max: 150 },
    { k: 'nombre_conyuge', l: 'Nombre del Cónyuge', t: 'text', max: 150 },
    { k: 'cantidad_hijos', l: 'Cantidad de Hijos', t: 'number' }
  ]],
  ['Datos bancarios', [
    { k: 'banco', l: 'Banco', t: 'text', max: 120 },
    { k: 'cbu', l: 'CBU', t: 'text', max: 30 },
    { k: 'nro_cuenta', l: 'N° de Cuenta', t: 'text', max: 30 }
  ]],
  ['Contacto', [
    { k: 'tel_fijo', l: 'Tel. Fijo', t: 'text', max: 50 },
    { k: 'celular_empleado', l: 'Celular Empleado', t: 'text', max: 50 },
    { k: 'celular_conyuge', l: 'Contacto Emergencia', t: 'text', max: 50 }
  ]],
  ['Ropa de Trabajo (Talles)', [
    { k: 'talle_camisa', l: 'Camisa', t: 'text', max: 20 },
    { k: 'talle_pantalon', l: 'Pantalón', t: 'text', max: 20 },
    { k: 'talle_zapato', l: 'Zapato', t: 'text', max: 20 },
    { k: 'talle_mameluco', l: 'Mameluco', t: 'text', max: 20 }
  ]],
  [SECCION_CROQUIS, CAMPOS_CROQUIS]
];

let fichaEmpleadoId = null;

// Croquis del domicilio: la manzana con las cuatro calles que la rodean. Se dibuja
// en SVG (y no como imagen) para que la ventana de impresion no dependa de ningun
// archivo servido aparte y para que el portal pueda escribir los nombres encima.
function croquisSVG(d) {
  const valorCalle = k => {
    const v = (d && d[k] !== undefined && d[k] !== null) ? String(d[k]).trim() : '';
    return v;
  };
  // Los nombres largos se comprimen al ancho del renglon para que no se monten
  // sobre las calles vecinas.
  const textoCalle = (k, x, y, ancho) => {
    const v = valorCalle(k);
    if (!v) return '';
    const ajuste = v.length > 11 ? ` textLength="${ancho}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text class="calle-valor" x="${x}" y="${y}"${ajuste}>${escAttr(v)}</text>`;
  };

  return `<svg viewBox="0 0 1780 1730" role="img" aria-label="Croquis del domicilio">
      <g class="calles">
        <path d="M425 495 H540 V380" />
        <path d="M675 380 V495 H1150 V380" />
        <path d="M1360 495 H1245 V380" />
        <path d="M425 620 H540 V1095 H425" />
        <path d="M1360 620 H1245 V1095 H1360" />
        <path d="M425 1210 H540 V1325" />
        <path d="M675 1325 V1210 H1150 V1325" />
        <path d="M1360 1210 H1245 V1325" />
      </g>
      <rect class="lote" x="675" y="620" width="475" height="475" />
      <text class="rosa" x="890" y="330" text-anchor="middle">N</text>
      <text class="rosa" x="890" y="1500" text-anchor="middle">S</text>
      <text class="rosa" x="330" y="920" text-anchor="middle">E</text>
      <text class="rosa" x="1450" y="920" text-anchor="middle">O</text>
      <text class="calle" x="675" y="585">calle 1:</text>
      <line class="renglon" x1="895" y1="590" x2="1150" y2="590" />
      ${textoCalle('croquis_calle_1', 900, 575, 245)}
      <text class="calle" x="675" y="1180">calle 2:</text>
      <line class="renglon" x1="895" y1="1185" x2="1150" y2="1185" />
      ${textoCalle('croquis_calle_2', 900, 1170, 245)}
      <g transform="rotate(-90 655 1085)">
        <text class="calle" x="655" y="1085">calle 3:</text>
        <line class="renglon" x1="875" y1="1090" x2="1085" y2="1090" />
        ${textoCalle('croquis_calle_3', 880, 1075, 200)}
      </g>
      <g transform="rotate(-90 1230 1085)">
        <text class="calle" x="1230" y="1085">calle 4:</text>
        <line class="renglon" x1="1450" y1="1090" x2="1660" y2="1090" />
        ${textoCalle('croquis_calle_4', 1455, 1075, 200)}
      </g>
    </svg>`;
}

function formatFechaCorta(fecha) {
  if (!fecha) return '';
  const partes = String(fecha).substring(0, 10).split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
}

function controlFicha(campo, valor) {
  // El email es el unico dato que va en minuscula; el resto en mayuscula.
  const v = campo.k === 'email'
    ? String(valor === null || valor === undefined ? '' : valor).toLowerCase()
    : mayus(valor);
  const id = `af-${campo.k}`;

  if (campo.t === 'select') {
    const opciones = ['', ...campo.op].map(o =>
      `<option value="${escAttr(o)}"${v === o ? ' selected' : ''}>${o ? escAttr(o) : 'Seleccionar...'}</option>`).join('');
    return `<select id="${id}"${campo.k === 'carnet_conducir' ? ' onchange="toggleCarnetFicha()"' : ''}>${opciones}</select>`;
  }
  if (campo.t === 'paises') {
    const esOtro = !!v && !PAISES_AMERICA.includes(v);
    return `<select id="${id}" onchange="toggleOtroFicha('${campo.k}')">
        <option value="">Seleccionar...</option>
        ${PAISES_AMERICA.map(p => `<option value="${escAttr(p)}"${v === p ? ' selected' : ''}>${escAttr(p)}</option>`).join('')}
        <option value="${VALOR_OTRO}"${esOtro ? ' selected' : ''}>Otro (cargar manualmente)</option>
      </select>
      <input type="text" id="${id}-otro" class="campo-otro${esOtro ? '' : ' hidden'}" maxlength="100" value="${esOtro ? escAttr(v) : ''}" placeholder="Escriba el valor">`;
  }
  if (campo.t === 'date') return `<input type="date" id="${id}" value="${escAttr(v.substring(0, 10))}">`;
  if (campo.t === 'number') return `<input type="number" id="${id}" min="0" max="99" step="1" value="${escAttr(v || 0)}">`;
  if (campo.t === 'textarea') return `<textarea id="${id}" rows="3">${escAttr(v)}</textarea>`;
  if (campo.t === 'clases') {
    return checkboxesClasesHTML('af-clase', v.split(',').map(c => c.trim()).filter(Boolean));
  }
  return `<input type="${campo.t === 'email' ? 'email' : 'text'}" id="${id}"${campo.max ? ` maxlength="${campo.max}"` : ''} value="${escAttr(v)}">`;
}

function formularioFichaHTML(d) {
  return CAMPOS_FICHA.map(([titulo, campos]) => {
    const anchos = campos.filter(c => c.ancho);
    const normales = campos.filter(c => !c.ancho);
    let html = `<h4 class="datos-seccion">${escAttr(titulo)}</h4><div class="ficha-grid">`;
    html += normales.map(c => `
      <div class="form-group">
        <label>${escAttr(c.l)}</label>
        ${controlFicha(c, d[c.k])}
      </div>`).join('');
    html += '</div>';
    if (anchos.length) {
      html += `<div id="ficha-carnet-detalle" class="${d.carnet_conducir === 'SI' ? '' : 'hidden'}">`;
      html += anchos.map(c => `
        <div class="form-group">
          <label>${escAttr(c.l)}</label>
          ${controlFicha(c, d[c.k])}
        </div>`).join('');
      html += '</div>';
    }
    return html;
  }).join('');
}

function toggleOtroFicha(campo) {
  const sel = document.getElementById(`af-${campo}`);
  const input = document.getElementById(`af-${campo}-otro`);
  const esOtro = sel.value === VALOR_OTRO;
  input.classList.toggle('hidden', !esOtro);
  if (!esOtro) input.value = '';
}

function toggleCarnetFicha() {
  const tiene = document.getElementById('af-carnet_conducir').value === 'SI';
  document.getElementById('ficha-carnet-detalle').classList.toggle('hidden', !tiene);
  if (!tiene) {
    document.querySelectorAll('.af-clase').forEach(c => c.checked = false);
    document.getElementById('af-carnet_vencimiento').value = '';
    document.getElementById('af-carnet_comentario').value = '';
  }
}

function leerFormularioFicha() {
  const payload = { beneficiarios: leerBeneficiariosDe('tabla-beneficiarios-ficha') };
  const tieneCarnet = document.getElementById('af-carnet_conducir').value === 'SI';

  CAMPOS_FICHA.forEach(([, campos]) => campos.forEach(c => {
    if (c.t === 'clases') {
      payload[c.k] = tieneCarnet
        ? Array.from(document.querySelectorAll('.af-clase:checked')).map(x => x.value).join(', ')
        : '';
      return;
    }
    const el = document.getElementById(`af-${c.k}`);
    if (!el) return;
    if ((c.k === 'carnet_vencimiento' || c.k === 'carnet_comentario') && !tieneCarnet) { payload[c.k] = ''; return; }
    if (c.t === 'paises' && el.value === VALOR_OTRO) {
      payload[c.k] = document.getElementById(`af-${c.k}-otro`).value.trim();
      return;
    }
    payload[c.k] = el.value.trim();
  }));
  return payload;
}

async function editarFichaEmpleado(id) {
  fichaEmpleadoId = id;
  const modal = document.getElementById('modal-datos-empleado');
  const cuerpo = document.getElementById('modal-datos-cuerpo');
  cuerpo.innerHTML = '<p class="datos-cargando">Cargando...</p>';
  document.getElementById('modal-datos-subtitulo').textContent = '';
  document.getElementById('btn-guardar-ficha').classList.add('hidden');
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`${API}/api/admin/empleados/${id}/datos`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al obtener los datos');

    document.getElementById('modal-datos-subtitulo').textContent =
      `${data.nombre}${data.empresa ? ' · ' + data.empresa : ''}`;

    // El DNI vive en empleados, no en la ficha: se inyecta para editarlo junto al resto.
    const d = Object.assign({}, data.datos || {}, { dni: data.dni });

    let html = formularioFichaHTML(d);
    html += `
      <h4 class="datos-seccion">Beneficiarios del Seguro</h4>
      <div class="table-responsive">
        <table class="tabla-beneficiarios">
          <thead>
            <tr><th>Apellido y Nombre</th><th>Parentesco</th><th>DNI</th><th>Porcentaje</th><th></th></tr>
          </thead>
          <tbody id="tabla-beneficiarios-ficha"></tbody>
        </table>
      </div>
      <div class="beneficiarios-footer">
        <button type="button" class="btn btn-outline btn-sm" onclick="agregarBeneficiarioEn('tabla-beneficiarios-ficha')">+ Agregar Beneficiario</button>
        <span id="beneficiarios-total-ficha" class="beneficiarios-total"></span>
      </div>`;
    if (d.updated_at) {
      html += `<p class="firma-fecha-guardada">Ultima actualizacion: ${escAttr(new Date(d.updated_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</p>`;
    }
    cuerpo.innerHTML = html;

    (data.beneficiarios || []).forEach(b => agregarBeneficiarioEn('tabla-beneficiarios-ficha', b));
    actualizarTotalDe('tabla-beneficiarios-ficha');
    document.getElementById('btn-guardar-ficha').classList.remove('hidden');
  } catch (err) {
    cuerpo.innerHTML = `<div class="info-box">${escAttr(err.message)}</div>`;
  }
}

async function guardarFichaEmpleado() {
  if (!fichaEmpleadoId) return;
  const boton = document.getElementById('btn-guardar-ficha');
  const texto = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  try {
    const res = await fetch(`${API}/api/admin/empleados/${fichaEmpleadoId}/datos`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(leerFormularioFicha())
    });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error);
    showToast(data.message);
    cerrarModalDatosEmpleado();
    cargarFichas();
    cargarEmpleados();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = texto;
  }
}

function cerrarModalDatosEmpleado() {
  document.getElementById('modal-datos-empleado').classList.add('hidden');
  fichaEmpleadoId = null;
}

// ---------- Imprimir ----------
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Lugar y fecha que cierran la declaracion jurada. Lleva la fecha en que se
// guardo la ficha (updated_at); si todavia no se guardo nunca, va la del dia.
// El replace del espacio por T es para el DATETIME de MySQL, que Safari no
// parsea en su formato original.
function lugarYFechaFicha(updatedAt) {
  let f = updatedAt ? new Date(String(updatedAt).replace(' ', 'T')) : new Date();
  if (isNaN(f.getTime())) f = new Date();
  const dia = String(f.getDate()).padStart(2, '0');
  return `San Juan ${dia} de ${MESES_ES[f.getMonth()]} de ${f.getFullYear()}`;
}

function fichaImprimibleHTML(data, logoDataUrl) {
  const d = Object.assign({}, data.datos || {}, { dni: data.dni });
  const secciones = CAMPOS_FICHA.filter(([titulo]) => titulo !== SECCION_CROQUIS).map(([titulo, campos]) => `
    <h2>${escAttr(titulo)}</h2>
    <div class="grid${titulo.startsWith('Ropa') ? ' grid-talles' : ''}">
      ${campos.map(c => {
        const valor = c.t === 'date' ? formatFechaCorta(d[c.k]) : d[c.k];
        return `<div class="item"><span class="lbl">${escAttr(c.l)}</span><span class="val">${escAttr(valor !== null && valor !== undefined && valor !== '' ? valor : '-')}</span></div>`;
      }).join('')}
    </div>`).join('');

  const benef = data.beneficiarios || [];
  const tablaBenef = benef.length === 0
    ? '<p class="vacio">Sin beneficiarios cargados.</p>'
    : `<table>
         <thead><tr><th>Apellido y Nombre</th><th>Parentesco</th><th>DNI</th><th>Porcentaje</th></tr></thead>
         <tbody>${benef.map(b => `<tr>
           <td>${escAttr(b.apellido_nombre)}</td><td>${escAttr(b.parentesco || '-')}</td>
           <td>${escAttr(b.dni || '-')}</td><td>${(parseFloat(b.porcentaje) || 0).toFixed(2)}%</td>
         </tr>`).join('')}</tbody>
       </table>`;

  const croquis = `<div class="croquis">${croquisSVG(d)}</div>`;

  // Cada empresa lleva su propio logo. Llega ya convertido a data URI (ver
  // logoEmpresaDataURL): la ventana de impresion es about:blank, asi que una ruta
  // relativa no resolveria y el dialogo podria abrirse antes de bajar la imagen.
  const logo = !logoDataUrl ? '' : `
    <div class="logo-empresa">
      <img src="${logoDataUrl}" alt="${escAttr(data.empresa || '')}">
    </div>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Ficha - ${escAttr(data.nombre)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 14mm; font-size: 12px; }
      header { display: flex; align-items: center; justify-content: space-between; gap: 16px;
               border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; margin-bottom: 18px; }
      header h1 { font-size: 18px; margin: 0; color: #1e3a5f; }
      /* Los dos logos tienen proporciones muy distintas (BTZ es apaisado y PI casi
         cuadrado): se limitan alto y ancho para que ninguno desborde el encabezado. */
      .logo-empresa { flex: none; }
      .logo-empresa img { max-height: 16mm; max-width: 55mm; object-fit: contain; display: block; }
      h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #1e3a5f;
           border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin: 16px 0 10px; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 18px; }
      .grid-talles { grid-template-columns: repeat(4, 1fr); }
      .grid-talles .item { flex-direction: row; align-items: baseline; gap: 5px; }
      .grid-talles .lbl::after { content: ':'; }
      .item { display: flex; flex-direction: column; }
      .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
      .val { font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th, td { border: 1px solid #e5e7eb; padding: 5px 8px; text-align: left; font-size: 11px; }
      th { background: #f3f4f6; }
      .vacio { font-size: 11px; color: #374151; margin-top: 6px; }
      /* Con @page en 0 la hoja 2 no tiene margen superior. Este bloque viaja entero
         (break-inside: avoid), asi que su padding le hace de margen si cae arriba
         de todo en la hoja siguiente. */
      .declaracion { margin-top: 12px; padding-top: 10mm; break-inside: avoid; }
      /* Solo el parrafo de la declaracion va justificado: con "p" a secas el
         justify tambien alcanzaba al pie de la firma y lo sacaba del centro. */
      .declaracion > p { font-size: 11px; line-height: 1.6; text-align: justify; margin: 0; }
      /* El margen de 1.6em (un renglon del parrafo de arriba) es el renglon en
         blanco que separa la declaracion del lugar y la fecha. */
      .declaracion > p.declaracion-fecha { margin-top: 1.6em; text-align: left; }
      .croquis { margin: 12px 0 0; text-align: center; break-inside: avoid; }
      .croquis svg { width: 92mm; max-width: 100%; height: auto; }
      .croquis .calles { fill: none; stroke: #374151; stroke-width: 3; }
      .croquis .lote { fill: none; stroke: #111827; stroke-width: 6; }
      .croquis .renglon { stroke: #111827; stroke-width: 3; }
      .croquis .rosa { font: bold 140px 'Segoe UI', sans-serif; fill: #1f2937; }
      .croquis .calle { font: 58px 'Segoe UI', sans-serif; fill: #1f2937; }
      .croquis .calle-valor { font: 46px 'Segoe UI', sans-serif; fill: #111827; }
      .firma { margin-top: 16mm; text-align: center; }
      .linea-firma { width: 70mm; margin: 0 auto; border-bottom: 1px solid #111827; }
      .firma-pie { margin: 6px 0 0; font-size: 11px; }
      /* El margen 0 de @page es lo que hace que Chrome/Edge no impriman su
         encabezado (fecha y hora) ni su pie (about:blank). El aire del papel
         lo pone el padding del body. */
      @page { size: A4; margin: 0; }
      @media print { h2 { break-after: avoid; } .grid { break-inside: avoid; } }
    </style></head><body>
    <header>
      <h1>DDJJ-Ficha de Datos Personales</h1>
      ${logo}
    </header>
    ${secciones}
    <h2>Beneficiarios del Seguro</h2>
    ${tablaBenef}
    <section class="declaracion">
      <p>Declaro bajo juramento que los datos antes consignados son fidedignos y me comprometo a informar cualquier modificación que se produzca a partir de la fecha, sirviendo los mismos a los efectos legales que pudiera corresponder.</p>
      <p class="declaracion-fecha">${escAttr(lugarYFechaFicha(d.updated_at))}</p>
      ${croquis}
      <div class="firma">
        <div class="linea-firma"></div>
        <p class="firma-pie">Firma del Ingresante</p>
      </div>
    </section>
    </body></html>`;
}

// Logo que va en la ficha impresa segun la empresa asignada al empleado.
const LOGOS_EMPRESA = {
  'BTZ MINERA': 'img/logo-btz-minera.png',
  'PERFORACIONES IGLESIANAS': 'img/logo-perforaciones-iglesianas.jpg'
};
const logosCache = {};

// Se devuelve como data URI para que quede incrustado en el HTML de impresion: la
// ventana no tiene URL propia y el dialogo se abre sin esperar descargas externas.
// Si el logo no se puede leer, la ficha sale sin logo en vez de fallar.
async function logoEmpresaDataURL(empresa) {
  const ruta = LOGOS_EMPRESA[String(empresa || '').trim().toUpperCase()];
  if (!ruta) return '';
  if (logosCache[ruta]) return logosCache[ruta];
  try {
    const res = await fetch(ruta);
    if (!res.ok) return '';
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () => reject(new Error('No se pudo leer el logo'));
      lector.readAsDataURL(blob);
    });
    logosCache[ruta] = dataUrl;
    return dataUrl;
  } catch (err) {
    console.error('Logo de empresa:', err);
    return '';
  }
}

async function imprimirFichaEmpleado(id) {
  // La ventana se abre antes del fetch: si se abriera despues del await, el
  // navegador lo trata como popup no solicitado y lo bloquea.
  const ventana = window.open('', '_blank');
  if (!ventana) {
    showToast('El navegador bloqueo la ventana de impresion. Permita las ventanas emergentes.', 'error');
    return;
  }
  ventana.document.write('<p style="font-family:sans-serif;margin:24px">Generando ficha...</p>');

  try {
    const res = await fetch(`${API}/api/admin/empleados/${id}/datos`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al obtener los datos');

    const logoDataUrl = await logoEmpresaDataURL(data.empresa);

    ventana.document.open();
    ventana.document.write(fichaImprimibleHTML(data, logoDataUrl));
    ventana.document.close();
    ventana.focus();

    // Segun el navegador, el load ya puede haber ocurrido al cerrar el document.
    // El flag evita que se abra el dialogo de impresion dos veces.
    let impreso = false;
    const imprimir = () => { if (!impreso) { impreso = true; ventana.print(); } };
    ventana.onload = imprimir;
    if (ventana.document.readyState === 'complete') setTimeout(imprimir, 250);
  } catch (err) {
    ventana.close();
    showToast(err.message, 'error');
  }
}

// ---------- WhatsApp ----------
// Normaliza a formato internacional argentino: 54 9 + area + numero.
function telefonoWhatsapp(numero) {
  let n = String(numero || '').replace(/\D/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('54')) n = n.slice(2);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.startsWith('9')) n = n.slice(1);
  return n.length >= 8 ? '549' + n : '';
}

function enviarWhatsappEmpleado(id) {
  const ficha = fichasCache.find(f => f.id === id);
  const numero = telefonoWhatsapp(ficha && ficha.celular_empleado);
  if (!numero) {
    showToast('El empleado no tiene cargado un celular valido en su ficha', 'error');
    return;
  }
  window.open(`https://wa.me/${numero}`, '_blank');
}

// ==================== ADMIN - LISTADO DE FICHAS ====================
// Las empresas son las mismas que se usan para los recibos de sueldo.
const EMPRESAS = ['BTZ MINERA', 'PERFORACIONES IGLESIANAS'];
let fichasCache = [];

async function cargarFichas() {
  try {
    const res = await fetch(`${API}/api/admin/fichas`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al listar las fichas');
    fichasCache = data;
    filtrarFichas();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function nombreFicha(f) {
  const completo = `${f.apellidos || ''} ${f.nombres || ''}`.trim();
  return completo || f.nombre || '-';
}

const ICONO_EDITAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const ICONO_IMPRIMIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
const ICONO_WHATSAPP = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.38-.27.3-1.04 1.01-1.04 2.470 0 1.45 1.06 2.86 1.21 3.06.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.21-8.24 8.21z"/></svg>';

function renderFichas(fichas) {
  const tbody = document.getElementById('tabla-fichas');
  if (fichas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--gray-500);padding:40px">No hay empleados que coincidan con el filtro</td></tr>';
    return;
  }
  tbody.innerHTML = fichas.map(f => {
    const conCelular = !!telefonoWhatsapp(f.celular_empleado);
    return `
    <tr>
      <td><strong>${escAttr(nombreFicha(f))}</strong></td>
      <td>${escAttr(f.dni)}</td>
      <td>${escAttr(f.celular_empleado || '-')}</td>
      <td>${escAttr(f.provincia || '-')}</td>
      <td>
        <select class="select-empresa" onchange="asignarEmpresaFicha(${f.id}, this)">
          <option value=""${!f.empresa ? ' selected' : ''}>Sin asignar</option>
          ${EMPRESAS.map(e => `<option value="${escAttr(e)}"${f.empresa === e ? ' selected' : ''}>${escAttr(e)}</option>`).join('')}
        </select>
      </td>
      <td><span class="badge ${f.tiene_ficha ? 'badge-success' : 'badge-warning'}">${f.tiene_ficha ? 'Cargada' : 'Pendiente'}</span></td>
      <td>
        <div class="acciones-iconos">
          <button class="btn-accion btn-accion-editar" title="Editar datos" onclick="editarFichaEmpleado(${f.id})">${ICONO_EDITAR}</button>
          <button class="btn-accion btn-accion-imprimir" title="Imprimir ficha" onclick="imprimirFichaEmpleado(${f.id})">${ICONO_IMPRIMIR}</button>
          <button class="btn-accion btn-accion-whatsapp" title="${conCelular ? 'Enviar WhatsApp al ' + escAttr(f.celular_empleado) : 'Sin celular cargado'}"${conCelular ? '' : ' disabled'} onclick="enviarWhatsappEmpleado(${f.id})">${ICONO_WHATSAPP}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filtrarFichas() {
  const q = document.getElementById('buscar-ficha').value.toLowerCase().trim();
  const empresa = document.getElementById('filtro-empresa-fichas').value;
  const estadoFicha = document.getElementById('filtro-estado-ficha').value;

  const filtradas = fichasCache.filter(f => {
    const texto = `${nombreFicha(f)} ${f.nombre || ''} ${f.dni || ''} ${f.cuit || ''}`.toLowerCase();
    const coincideTexto = !q || texto.includes(q);
    const coincideEmpresa = !empresa
      || (empresa === '__sin__' ? !f.empresa : f.empresa === empresa);
    const coincideFicha = !estadoFicha
      || (estadoFicha === 'completa' ? !!f.tiene_ficha : !f.tiene_ficha);
    return coincideTexto && coincideEmpresa && coincideFicha;
  });
  renderFichas(filtradas);
}

function limpiarFiltroFichas() {
  document.getElementById('buscar-ficha').value = '';
  document.getElementById('filtro-empresa-fichas').value = '';
  document.getElementById('filtro-estado-ficha').value = '';
  filtrarFichas();
}

// Exporta lo que el admin esta viendo: se mandan los mismos filtros de la tabla.
async function exportarFichasExcel() {
  const boton = document.getElementById('btn-exportar-fichas');
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Generando...';

  const params = new URLSearchParams({
    q: document.getElementById('buscar-ficha').value.trim(),
    empresa: document.getElementById('filtro-empresa-fichas').value,
    ficha: document.getElementById('filtro-estado-ficha').value
  });

  try {
    const res = await fetch(`${API}/api/admin/fichas/export?${params.toString()}`, { headers: headersAuth() });
    if (!res.ok) {
      const data = await leerJson(res).catch(err => ({ error: err.message }));
      throw new Error(data.error || 'Error al generar el Excel');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `datos-empleados-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('Excel generado exitosamente');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

async function asignarEmpresaFicha(id, select) {
  const ficha = fichasCache.find(f => f.id === id);
  const anterior = ficha ? (ficha.empresa || '') : '';
  const empresa = select.value;
  select.disabled = true;
  try {
    const res = await fetch(`${API}/api/admin/empleados/${id}/empresa`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ empresa })
    });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error);

    if (ficha) ficha.empresa = empresa;
    const emp = empleadosCache.find(e => e.id === id);
    if (emp) emp.empresa = empresa;

    showToast(data.message);
    // La empresa tambien alimenta el modulo de empleados y la carga de recibos, asi
    // que se refrescan sin perder los filtros. Los recibos ya subidos no cambian:
    // cada uno guarda la empresa que tenia el empleado al momento de la carga.
    filtrarEmpleados();
    filtrarSelectEmpleados();
  } catch (err) {
    select.value = anterior;
    showToast(err.message, 'error');
  } finally {
    select.disabled = false;
  }
}

// ==================== RECIBOS UPLOAD ====================
function cargarSelectEmpleados() {
  const filtroEmpresa = document.getElementById('recibo-filtro-empresa');
  if (filtroEmpresa) filtroEmpresa.value = '';
  filtrarSelectEmpleados();
}

function filtrarSelectEmpleados() {
  const select = document.getElementById('recibo-empleado');
  const empresa = document.getElementById('recibo-filtro-empresa').value;
  select.innerHTML = '<option value="">Seleccione un empleado</option>';
  empleadosCache.filter(e => e.estado === 'activo' && (!empresa || e.empresa === empresa)).forEach(emp => {
    select.innerHTML += `<option value="${emp.id}">${emp.nombre} - DNI: ${emp.dni}</option>`;
  });
}

function switchUploadMode(mode) {
  document.querySelectorAll('.upload-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.upload-tab[onclick*="${mode}"]`).classList.add('active');
  if (mode === 'individual') {
    document.getElementById('form-upload-individual').classList.remove('hidden');
    document.getElementById('form-upload-masivo').classList.add('hidden');
  } else {
    document.getElementById('form-upload-individual').classList.add('hidden');
    document.getElementById('form-upload-masivo').classList.remove('hidden');
  }
  document.getElementById('upload-resultado').classList.add('hidden');
}

// File input listeners
document.addEventListener('DOMContentLoaded', () => {
  setupFileInput('recibo-archivos', 'archivos-seleccionados');
  setupFileInput('recibo-archivos-masivo', 'archivos-seleccionados-masivo');
  setupFileInput('config-pdf-archivo', 'config-pdf-seleccionado');

  llenarSelectAnios('recibo-anio', false);
  llenarSelectAnios('recibo-masivo-anio', false);
  llenarSelectAnios('filtro-anio-historial', true);

  // Restaurar sesión si existe
  const savedToken = localStorage.getItem('token');
  const savedRole = localStorage.getItem('userRole');
  const savedName = localStorage.getItem('userName');
  if (savedToken && savedRole) {
    token = savedToken;
    userRole = savedRole;
    if (savedRole === 'admin') {
      document.getElementById('admin-nombre').textContent = savedName || '';
      showScreen('admin-screen');
      cargarDashboard();
    } else if (savedRole === 'empleado') {
      document.getElementById('empleado-nombre').textContent = savedName || '';
      showScreen('empleado-screen');
      cargarRecibosEmpleado();
    }
  }
});

function setupFileInput(inputId, listaId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', () => {
    const lista = document.getElementById(listaId);
    if (input.files.length > 0) {
      lista.innerHTML = Array.from(input.files).map(f =>
        `<div class="archivo-item">&#128196; ${f.name} (${(f.size/1024).toFixed(1)} KB)</div>`
      ).join('');
    } else {
      lista.innerHTML = '';
    }
  });
}

async function subirReciboIndividual(e) {
  e.preventDefault();
  const resultadoEl = document.getElementById('upload-resultado');
  const periodo = getPeriodoSeleccionado('recibo');
  if (!periodo) {
    showToast('Seleccione el periodo del recibo', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('empleado_id', document.getElementById('recibo-empleado').value);
  formData.append('fecha_recibo', periodo);
  formData.append('descripcion', document.getElementById('recibo-descripcion').value);

  const files = document.getElementById('recibo-archivos').files;
  if (files.length === 0) {
    showToast('Seleccione al menos un archivo PDF', 'error');
    return;
  }
  for (let f of files) formData.append('pdfs', f);

  try {
    const res = await fetch(`${API}/api/admin/recibos`, {
      method: 'POST',
      headers: headersAuth(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    resultadoEl.className = 'success';
    resultadoEl.textContent = data.message;
    resultadoEl.classList.remove('hidden');
    showToast(data.message);
    document.getElementById('form-upload-individual').reset();
    toggleTipoPeriodo('recibo');
    document.getElementById('archivos-seleccionados').innerHTML = '';
    cargarEstadisticas();
  } catch (err) {
    resultadoEl.className = 'error';
    resultadoEl.textContent = err.message;
    resultadoEl.classList.remove('hidden');
    showToast(err.message, 'error');
  }
}

async function subirReciboMasivo(e) {
  e.preventDefault();
  const resultadoEl = document.getElementById('upload-resultado');
  const periodo = getPeriodoSeleccionado('recibo-masivo');
  if (!periodo) {
    showToast('Seleccione el periodo del recibo', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('fecha_recibo', periodo);
  formData.append('descripcion', document.getElementById('recibo-descripcion-masivo').value);

  const files = document.getElementById('recibo-archivos-masivo').files;
  if (files.length === 0) {
    showToast('Seleccione al menos un archivo PDF', 'error');
    return;
  }
  for (let f of files) formData.append('pdfs', f);

  try {
    const res = await fetch(`${API}/api/admin/recibos/masivo`, {
      method: 'POST',
      headers: headersAuth(),
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    let msg = data.message;
    if (data.no_encontrados && data.no_encontrados.length > 0) {
      msg += `\nArchivos sin asignar: ${data.no_encontrados.join(', ')}`;
    }
    resultadoEl.className = 'success';
    resultadoEl.innerHTML = msg.replace(/\n/g, '<br>');
    resultadoEl.classList.remove('hidden');
    showToast(data.message);
    document.getElementById('form-upload-masivo').reset();
    toggleTipoPeriodo('recibo-masivo');
    document.getElementById('archivos-seleccionados-masivo').innerHTML = '';
    cargarEstadisticas();
  } catch (err) {
    resultadoEl.className = 'error';
    resultadoEl.textContent = err.message;
    resultadoEl.classList.remove('hidden');
    showToast(err.message, 'error');
  }
}

// ==================== CONFIGURACION - IMPORTAR EMPLEADOS DESDE PDF ====================
let importacionPdfNuevos = [];

async function subirPdfConfiguracion(e) {
  e.preventDefault();
  const empresa = document.getElementById('config-pdf-empresa').value;
  if (!empresa) {
    showToast('Seleccione la empresa antes de analizar el PDF', 'error');
    return;
  }
  const input = document.getElementById('config-pdf-archivo');
  if (!input.files || input.files.length === 0) {
    showToast('Seleccione un archivo PDF', 'error');
    return;
  }
  const formData = new FormData();
  formData.append('pdf', input.files[0]);

  const resultadoEl = document.getElementById('config-pdf-resultado');
  const resumenEl = document.getElementById('config-pdf-resumen');
  try {
    const res = await fetch(`${API}/api/admin/configuracion/importar-pdf`, {
      method: 'POST',
      headers: headersAuth(),
      body: formData
    });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error);

    importacionPdfNuevos = data.nuevos;
    resultadoEl.classList.remove('hidden');
    resumenEl.className = 'resultado-msg success';
    resumenEl.textContent = `Se detectaron ${data.total} empleado(s) en el PDF: ${data.nuevos.length} nuevo(s) y ${data.existentes.length} ya registrado(s).`;

    renderNuevosImportados(data.nuevos);
    renderExistentesImportados(data.existentes);
  } catch (err) {
    importacionPdfNuevos = [];
    resultadoEl.classList.remove('hidden');
    resumenEl.className = 'resultado-msg error';
    resumenEl.textContent = err.message;
    document.getElementById('config-pdf-nuevos-container').classList.add('hidden');
    document.getElementById('config-pdf-existentes-container').classList.add('hidden');
    showToast(err.message, 'error');
  }
}

function renderNuevosImportados(nuevos) {
  const container = document.getElementById('config-pdf-nuevos-container');
  const tbody = document.getElementById('config-tabla-nuevos');
  if (!nuevos || nuevos.length === 0) {
    container.classList.add('hidden');
    tbody.innerHTML = '';
    return;
  }
  container.classList.remove('hidden');
  document.getElementById('config-check-todos').checked = true;
  tbody.innerHTML = nuevos.map((emp, i) => `
    <tr>
      <td><input type="checkbox" class="config-check-nuevo" data-idx="${i}" checked></td>
      <td>${emp.nombre}</td>
      <td>${emp.dni}</td>
      <td>${emp.dni.slice(-4)}</td>
    </tr>
  `).join('');
}

function renderExistentesImportados(existentes) {
  const container = document.getElementById('config-pdf-existentes-container');
  const tbody = document.getElementById('config-tabla-existentes');
  if (!existentes || existentes.length === 0) {
    container.classList.add('hidden');
    tbody.innerHTML = '';
    return;
  }
  container.classList.remove('hidden');
  tbody.innerHTML = existentes.map(emp => `
    <tr>
      <td>${emp.nombre}</td>
      <td>${emp.dni}</td>
      <td>${emp.nombreRegistrado}</td>
    </tr>
  `).join('');
}

function toggleTodosImportados() {
  const marcar = document.getElementById('config-check-todos').checked;
  document.querySelectorAll('.config-check-nuevo').forEach(c => c.checked = marcar);
}

async function guardarNuevosEmpleadosImportados() {
  const empresa = document.getElementById('config-pdf-empresa').value;
  if (!empresa) {
    showToast('Seleccione la empresa antes de guardar', 'error');
    return;
  }
  const seleccionados = [];
  document.querySelectorAll('.config-check-nuevo').forEach(chk => {
    if (chk.checked) seleccionados.push(importacionPdfNuevos[parseInt(chk.dataset.idx)]);
  });
  if (seleccionados.length === 0) {
    showToast('Seleccione al menos un empleado nuevo para guardar', 'error');
    return;
  }
  try {
    const res = await fetch(`${API}/api/admin/configuracion/importar-pdf/guardar`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ empleados: seleccionados, empresa })
    });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error);
    showToast(data.message);
    if (data.omitidos && data.omitidos.length > 0) {
      showToast(`${data.omitidos.length} no se guardaron (ya existían o datos inválidos)`, 'error');
    }
    document.getElementById('config-pdf-resultado').classList.add('hidden');
    document.getElementById('form-importar-pdf').reset();
    document.getElementById('config-pdf-seleccionado').innerHTML = '';
    importacionPdfNuevos = [];
    cargarEmpleados();
    cargarEstadisticas();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== ADMIN - FIRMA ADMINISTRATIVA ====================
let firmaAdminCanvasCtx = null;
let firmaAdminDibujando = false;
let firmaAdminVacia = true;
let firmaAdminFuente = 'Dancing Script';
let firmaAdminCanvasIniciado = false;

async function cargarFirmasAdmin() {
  try {
    const res = await fetch(`${API}/api/admin/firma`, { headers: headersAuth() });
    const data = await res.json();
    const containerActual = document.getElementById('firma-admin-actual-container');
    const sinFirma = document.getElementById('firma-admin-sin-firma');

    if (data.tiene_firma) {
      containerActual.classList.remove('hidden');
      sinFirma.classList.add('hidden');
      document.getElementById('firma-admin-actual-img').src = data.firma_data;
      document.getElementById('firma-admin-fecha-texto').textContent =
        'Guardada el ' + new Date(data.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      containerActual.classList.add('hidden');
      sinFirma.classList.remove('hidden');
    }
  } catch (err) {
    console.error(err);
  }
  initFirmaAdminCanvas();
}

function switchFirmaAdminSubtab(subtab) {
  const tab = document.getElementById('tab-firmas');
  tab.querySelectorAll('.firma-subtab').forEach(t => t.classList.remove('active'));
  tab.querySelectorAll('.firma-sub-content').forEach(t => t.classList.remove('active'));
  tab.querySelector(`.firma-subtab[onclick*="${subtab}"]`).classList.add('active');
  document.getElementById(`firma-admin-sub-${subtab}`).classList.add('active');
}

// --- Dibujar firma ---
function initFirmaAdminCanvas() {
  const canvas = document.getElementById('firma-admin-canvas');
  if (!canvas || firmaAdminCanvasIniciado) return;
  firmaAdminCanvasIniciado = true;
  firmaAdminCanvasCtx = canvas.getContext('2d');

  canvas.addEventListener('mousedown', firmaAdminStart);
  canvas.addEventListener('mousemove', firmaAdminDraw);
  canvas.addEventListener('mouseup', firmaAdminEnd);
  canvas.addEventListener('mouseleave', firmaAdminEnd);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); firmaAdminStart(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); firmaAdminDraw(e.touches[0]); }, { passive: false });
  canvas.addEventListener('touchend', firmaAdminEnd);
}

function firmaAdminStart(e) {
  firmaAdminDibujando = true;
  firmaAdminVacia = false;
  document.getElementById('firma-admin-placeholder').style.display = 'none';
  const canvas = document.getElementById('firma-admin-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  firmaAdminCanvasCtx.beginPath();
  firmaAdminCanvasCtx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
}

function firmaAdminDraw(e) {
  if (!firmaAdminDibujando) return;
  const canvas = document.getElementById('firma-admin-canvas');
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  firmaAdminCanvasCtx.lineWidth = 2.5;
  firmaAdminCanvasCtx.lineCap = 'round';
  firmaAdminCanvasCtx.lineJoin = 'round';
  firmaAdminCanvasCtx.strokeStyle = '#1e3a5f';
  firmaAdminCanvasCtx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  firmaAdminCanvasCtx.stroke();
}

function firmaAdminEnd() {
  firmaAdminDibujando = false;
}

function limpiarFirmaAdminCanvas() {
  const canvas = document.getElementById('firma-admin-canvas');
  if (firmaAdminCanvasCtx) {
    firmaAdminCanvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
  firmaAdminVacia = true;
  document.getElementById('firma-admin-placeholder').style.display = '';
}

async function guardarFirmaAdminDibujada() {
  if (firmaAdminVacia) {
    showToast('Debe dibujar la firma antes de guardar', 'error');
    return;
  }
  const firmaData = document.getElementById('firma-admin-canvas').toDataURL('image/png');
  await enviarFirmaAdmin(firmaData);
}

// --- Escribir firma ---
function seleccionarFuenteFirmaAdmin(fuente) {
  firmaAdminFuente = fuente;
  const tab = document.getElementById('tab-firmas');
  tab.querySelectorAll('#firma-admin-sub-escribir .firma-fuente-opcion').forEach(o => o.classList.remove('active'));
  tab.querySelector(`#firma-admin-sub-escribir .firma-fuente-opcion input[value="${fuente}"]`).parentElement.classList.add('active');
  previsualizarFirmaAdminEscrita();
}

function previsualizarFirmaAdminEscrita() {
  const texto = document.getElementById('firma-admin-escrita-input').value.trim();
  const canvas = document.getElementById('firma-admin-escrita-canvas');
  const ctx = canvas.getContext('2d');
  const placeholder = document.getElementById('firma-admin-escrita-placeholder');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!texto) {
    placeholder.style.display = '';
    return;
  }
  placeholder.style.display = 'none';
  const fontSize = Math.min(60, 560 / (texto.length * 0.55));
  ctx.font = `${fontSize}px '${firmaAdminFuente}', cursive`;
  ctx.fillStyle = '#1e3a5f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, canvas.width / 2, canvas.height / 2);
}

function limpiarFirmaAdminEscrita() {
  const input = document.getElementById('firma-admin-escrita-input');
  if (input) {
    input.value = '';
    const canvas = document.getElementById('firma-admin-escrita-canvas');
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    const ph = document.getElementById('firma-admin-escrita-placeholder');
    if (ph) ph.style.display = '';
  }
}

async function guardarFirmaAdminEscrita() {
  const texto = document.getElementById('firma-admin-escrita-input').value.trim();
  if (!texto) {
    showToast('Debe escribir el nombre para la firma', 'error');
    return;
  }
  previsualizarFirmaAdminEscrita();
  const firmaData = document.getElementById('firma-admin-escrita-canvas').toDataURL('image/png');
  await enviarFirmaAdmin(firmaData);
}

// --- Cargar firma desde archivo ---
let firmaAdminCargadaDataUrl = null;

function previsualizarFirmaAdminCargada(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    showToast('Solo se permiten archivos JPG o PNG', 'error');
    event.target.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showToast('El archivo no debe superar los 2MB', 'error');
    event.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    firmaAdminCargadaDataUrl = e.target.result;
    const img = document.getElementById('firma-admin-cargar-preview');
    img.src = firmaAdminCargadaDataUrl;
    img.style.display = '';
    document.getElementById('firma-admin-cargar-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function limpiarFirmaAdminCargada() {
  firmaAdminCargadaDataUrl = null;
  const input = document.getElementById('firma-admin-cargar-input');
  if (input) input.value = '';
  const img = document.getElementById('firma-admin-cargar-preview');
  if (img) { img.src = ''; img.style.display = 'none'; }
  const ph = document.getElementById('firma-admin-cargar-placeholder');
  if (ph) ph.style.display = '';
}

async function guardarFirmaAdminCargada() {
  if (!firmaAdminCargadaDataUrl) {
    showToast('Debe seleccionar un archivo JPG o PNG', 'error');
    return;
  }
  await enviarFirmaAdmin(firmaAdminCargadaDataUrl);
  limpiarFirmaAdminCargada();
}

// --- Enviar firma al servidor ---
async function enviarFirmaAdmin(firmaData) {
  try {
    const res = await fetch(`${API}/api/admin/firma`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ firma_data: firmaData })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Firma guardada exitosamente');
    limpiarFirmaAdminCanvas();
    limpiarFirmaAdminEscrita();
    cargarFirmasAdmin();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- Eliminar firma ---
function confirmarEliminarFirmaAdmin() {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('modal-titulo').textContent = 'Eliminar Firma';
  document.getElementById('modal-mensaje').textContent = '¿Está seguro de eliminar la firma administrativa? Los recibos que se suban después no tendrán firma.';
  modal.classList.remove('hidden');
  document.getElementById('modal-confirmar').onclick = async () => {
    try {
      const res = await fetch(`${API}/api/admin/firma`, {
        method: 'DELETE',
        headers: headersAuth()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast('Firma eliminada exitosamente');
      cerrarModal();
      cargarFirmasAdmin();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ==================== HISTORIAL RECIBOS ====================
let historialRecibosData = [];

async function cargarHistorialRecibos() {
  try {
    const res = await fetch(`${API}/api/admin/recibos`, { headers: headersAuth() });
    historialRecibosData = await res.json();
    renderHistorialRecibos(historialRecibosData);
  } catch (err) {
    console.error(err);
  }
}

function renderHistorialRecibos(recibos) {
  const tbody = document.getElementById('tabla-recibos-historial');
  if (recibos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray-500);padding:40px">No hay recibos que coincidan</td></tr>';
    return;
  }
  tbody.innerHTML = recibos.map(r => `
    <tr>
      <td><strong>${r.empleado_nombre}</strong></td>
      <td>${r.dni}</td>
      <td>${escAttr(r.empresa || '-')}</td>
      <td>${formatFecha(r.fecha_recibo)}</td>
      <td>${r.archivo_nombre}</td>
      <td>${r.descripcion || '-'}</td>
      <td style="text-align:center">
        <span class="firma-circulo ${r.firmado ? 'firma-si' : 'firma-no'}" title="${r.firmado ? 'Firmado el ' + new Date(r.fecha_firma).toLocaleDateString('es-AR') : 'Pendiente de firma'}"></span>
      </td>
      <td style="text-align:center;font-size:0.85em">
        ${r.fecha_descarga ? new Date(r.fecha_descarga).toLocaleDateString('es-AR') : '<span style="color:var(--gray-400)">No descargado</span>'}
      </td>
      <td style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-outline btn-sm" style="min-width:90px" onclick="descargarRecibo(${r.id})">Descargar</button>
        ${r.firmado ? `<button class="btn btn-sm" style="background:var(--primary);color:#fff;min-width:90px" onclick="verReciboFirmado(${r.id})">Ver Firmado</button>` : ''}
        <button class="btn btn-danger btn-sm" style="min-width:90px;margin-left:auto" onclick="confirmarEliminarRecibo(${r.id})">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

function verReciboFirmado(id) {
  window.open(`${API}/api/admin/recibo-firmado/${id}?token=${token}`, '_blank');
}

function toggleTipoFiltroHistorial() {
  const esSac = document.getElementById('filtro-tipo-historial').value !== 'mensual';
  document.getElementById('filtro-fecha-historial').classList.toggle('hidden', esSac);
  document.getElementById('filtro-anio-historial').classList.toggle('hidden', !esSac);
  filtrarHistorialRecibos();
}

// Sin año elegido, el filtro SAC muestra ese complementario de todos los años.
function coincidePeriodoFiltro(fechaRecibo) {
  const periodo = fechaRecibo || '';
  const tipo = document.getElementById('filtro-tipo-historial').value;
  if (tipo === 'mensual') {
    const mes = document.getElementById('filtro-fecha-historial').value;
    return !mes || periodo === mes;
  }
  const anio = document.getElementById('filtro-anio-historial').value;
  return anio ? periodo === `${anio}-${tipo}` : periodo.endsWith(`-${tipo}`);
}

function filtrarHistorialRecibos() {
  const busqueda = document.getElementById('buscar-empleado-historial').value.toLowerCase().trim();
  const empresa = document.getElementById('filtro-empresa-historial').value;
  const filtrados = historialRecibosData.filter(r => {
    const coincideTexto = !busqueda || r.empleado_nombre.toLowerCase().includes(busqueda) || r.dni.toLowerCase().includes(busqueda);
    const coincideEmpresa = !empresa || (r.empresa || '') === empresa;
    const coincideFecha = coincidePeriodoFiltro(r.fecha_recibo);
    return coincideTexto && coincideEmpresa && coincideFecha;
  });
  renderHistorialRecibos(filtrados);
}

function limpiarFiltroHistorial() {
  document.getElementById('buscar-empleado-historial').value = '';
  document.getElementById('filtro-empresa-historial').value = '';
  document.getElementById('filtro-tipo-historial').value = 'mensual';
  document.getElementById('filtro-fecha-historial').value = '';
  document.getElementById('filtro-anio-historial').value = '';
  document.getElementById('filtro-fecha-historial').classList.remove('hidden');
  document.getElementById('filtro-anio-historial').classList.add('hidden');
  renderHistorialRecibos(historialRecibosData);
}

async function descargarRecibo(id) {
  if (userRole !== 'empleado') {
    window.open(`${API}/api/recibo/descargar/${id}?token=${token}`, '_blank');
    return;
  }

  // Buscar el recibo en cache para ver si ya esta firmado
  const recibo = recibosEmpleadoCache.find(r => r.id === id);
  if (recibo && recibo.firmado) {
    window.open(`${API}/api/recibo/descargar/${id}?token=${token}`, '_blank');
    return;
  }

  // No firmado: verificar si tiene firma personal creada
  try {
    const res = await fetch(`${API}/api/empleado/mi-firma`, { headers: headersAuth() });
    const data = await res.json();
    if (!data.tiene_firma) {
      showToast('Primero debe crear su firma en la seccion "Mi Firma"', 'error');
      switchEmpTab('firma');
      return;
    }
    // Descargar directamente - la firma se embebe automaticamente en el backend
    window.open(`${API}/api/recibo/descargar/${id}?token=${token}`, '_blank');
    showToast('PDF descargado con firma incluida');
    // Recargar para actualizar estado de firma
    setTimeout(() => cargarRecibosEmpleado(), 1000);
  } catch (err) {
    showToast('Error al verificar firma', 'error');
  }
}

function confirmarEliminarRecibo(id) {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('modal-titulo').textContent = 'Eliminar Recibo';
  document.getElementById('modal-mensaje').textContent = '¿Está seguro de eliminar este recibo?';
  modal.classList.remove('hidden');
  document.getElementById('modal-confirmar').onclick = async () => {
    try {
      const res = await fetch(`${API}/api/admin/recibos/${id}`, {
        method: 'DELETE',
        headers: headersAuth()
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(result.message);
      cargarHistorialRecibos();
      cargarEstadisticas();
    } catch (err) {
      showToast(err.message, 'error');
    }
    cerrarModal();
  };
}

// ==================== EMPLEADO - TABS ====================
function switchEmpTab(tab) {
  document.querySelectorAll('.emp-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.emp-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.emp-tab[onclick*="${tab}"]`).classList.add('active');
  document.getElementById(`emp-tab-${tab}`).classList.add('active');

  if (tab === 'firma') cargarMiFirma();
  if (tab === 'datos') cargarMisDatos();
}

// ==================== EMPLEADO - MI FIRMA ====================
let firmaCanvas, firmaCtx, firmaDibujando = false, firmaVacia = true, firmaReciboId = null;
let firmaCanvasIniciado = false;

function initFirmaCanvas() {
  firmaCanvas = document.getElementById('firma-canvas');
  if (!firmaCanvas || firmaCanvasIniciado) return;
  firmaCanvasIniciado = true;
  firmaCtx = firmaCanvas.getContext('2d');

  firmaCanvas.addEventListener('mousedown', firmaStart);
  firmaCanvas.addEventListener('mousemove', firmaDraw);
  firmaCanvas.addEventListener('mouseup', firmaEnd);
  firmaCanvas.addEventListener('mouseleave', firmaEnd);

  firmaCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); firmaStart(e.touches[0]); }, { passive: false });
  firmaCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); firmaDraw(e.touches[0]); }, { passive: false });
  firmaCanvas.addEventListener('touchend', firmaEnd);
}

function firmaStart(e) {
  firmaDibujando = true;
  firmaVacia = false;
  document.getElementById('firma-placeholder').style.display = 'none';
  const rect = firmaCanvas.getBoundingClientRect();
  const scaleX = firmaCanvas.width / rect.width;
  const scaleY = firmaCanvas.height / rect.height;
  firmaCtx.beginPath();
  firmaCtx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
}

function firmaDraw(e) {
  if (!firmaDibujando) return;
  const rect = firmaCanvas.getBoundingClientRect();
  const scaleX = firmaCanvas.width / rect.width;
  const scaleY = firmaCanvas.height / rect.height;
  firmaCtx.lineWidth = 2.5;
  firmaCtx.lineCap = 'round';
  firmaCtx.lineJoin = 'round';
  firmaCtx.strokeStyle = '#1e3a5f';
  firmaCtx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  firmaCtx.stroke();
}

function firmaEnd() {
  firmaDibujando = false;
}

function limpiarFirmaEditor() {
  if (!firmaCtx) return;
  firmaCtx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
  firmaVacia = true;
  document.getElementById('firma-placeholder').style.display = '';
}

async function cargarMiFirma() {
  initFirmaCanvas();
  try {
    const res = await fetch(`${API}/api/empleado/mi-firma`, { headers: headersAuth() });
    const data = await res.json();
    const container = document.getElementById('firma-actual-container');
    if (data.tiene_firma) {
      container.classList.remove('hidden');
      document.getElementById('firma-actual-img').src = data.firma_data;
      document.getElementById('firma-fecha-texto').textContent =
        'Guardada el ' + new Date(data.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      document.getElementById('firma-editor-titulo').textContent = 'Editar firma';
    } else {
      container.classList.add('hidden');
      document.getElementById('firma-editor-titulo').textContent = 'Dibuje su firma';
    }
  } catch (err) {
    console.error(err);
  }
}

async function guardarMiFirma() {
  if (firmaVacia) {
    showToast('Debe dibujar su firma antes de guardar', 'error');
    return;
  }

  const firmaData = firmaCanvas.toDataURL('image/png');

  try {
    const res = await fetch(`${API}/api/empleado/mi-firma`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ firma_data: firmaData })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Firma guardada exitosamente');
    limpiarFirmaEditor();
    cargarMiFirma();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== FIRMA - SUB-TABS ====================
let firmaFuenteActual = 'Dancing Script';

function switchFirmaSubtab(subtab) {
  document.querySelectorAll('.firma-subtab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.firma-sub-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`.firma-subtab[onclick*="${subtab}"]`).classList.add('active');
  document.getElementById(`firma-sub-${subtab}`).classList.add('active');
}

function seleccionarFuenteFirma(fuente) {
  firmaFuenteActual = fuente;
  document.querySelectorAll('.firma-fuente-opcion').forEach(o => o.classList.remove('active'));
  document.querySelector(`.firma-fuente-opcion input[value="${fuente}"]`).parentElement.classList.add('active');
  previsualizarFirmaEscrita();
}

function previsualizarFirmaEscrita() {
  const texto = document.getElementById('firma-escrita-input').value.trim();
  const canvas = document.getElementById('firma-escrita-canvas');
  const ctx = canvas.getContext('2d');
  const placeholder = document.getElementById('firma-escrita-placeholder');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!texto) {
    placeholder.style.display = '';
    return;
  }
  placeholder.style.display = 'none';

  // Dibujar texto cursivo en el canvas
  const fontSize = Math.min(60, 560 / (texto.length * 0.55));
  ctx.font = `${fontSize}px '${firmaFuenteActual}', cursive`;
  ctx.fillStyle = '#1e3a5f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, canvas.width / 2, canvas.height / 2);
}

function limpiarFirmaEscrita() {
  document.getElementById('firma-escrita-input').value = '';
  const canvas = document.getElementById('firma-escrita-canvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  document.getElementById('firma-escrita-placeholder').style.display = '';
}

async function guardarFirmaEscrita() {
  const texto = document.getElementById('firma-escrita-input').value.trim();
  if (!texto) {
    showToast('Debe escribir su nombre para la firma', 'error');
    return;
  }

  // Regenerar para asegurar que el canvas tenga la firma actual
  previsualizarFirmaEscrita();

  const canvas = document.getElementById('firma-escrita-canvas');
  const firmaData = canvas.toDataURL('image/png');

  try {
    const res = await fetch(`${API}/api/empleado/mi-firma`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ firma_data: firmaData })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Firma escrita guardada exitosamente');
    limpiarFirmaEscrita();
    cargarMiFirma();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== EMPLEADO - FIRMAR RECIBO ====================
function cerrarModalFirma() {
  document.getElementById('modal-firma').classList.add('hidden');
  firmaReciboId = null;
}

async function confirmarFirmaRecibo() {
  if (!firmaReciboId) return;

  try {
    const res = await fetch(`${API}/api/empleado/recibo/${firmaReciboId}/firmar`, {
      method: 'POST',
      headers: headers()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Recibo firmado exitosamente');
    cerrarModalFirma();
    window.open(`${API}/api/recibo/descargar/${firmaReciboId}?token=${token}`, '_blank');
    cargarRecibosEmpleado();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== USUARIOS ADMIN CRUD ====================
let usuariosCache = [];

async function cargarUsuarios() {
  try {
    const res = await fetch(`${API}/api/admin/usuarios`, { headers: headersAuth() });
    usuariosCache = await res.json();
    renderUsuarios(usuariosCache);
  } catch (err) {
    console.error(err);
  }
}

function renderUsuarios(usuarios) {
  const tbody = document.getElementById('tabla-usuarios');
  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--gray-500)">No hay usuarios registrados</td></tr>';
    return;
  }
  tbody.innerHTML = usuarios.map(u => `
    <tr>
      <td>${u.nombre}</td>
      <td>${u.usuario}</td>
      <td><span class="badge ${u.estado === 'activo' ? 'badge-success' : 'badge-danger'}">${u.estado || 'activo'}</span></td>
      <td><span class="badge ${u.permiso === 'administrativo' ? 'badge-primary' : u.permiso === 'supervisor' ? 'badge-warning' : 'badge-info'}">${u.permiso || 'administrativo'}</span></td>
      <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('es-AR') : '-'}</td>
      <td>
        <div class="action-btns">
          <button class="btn btn-outline btn-sm" onclick="editarUsuario(${u.id})">Editar</button>
          ${(localStorage.getItem('userPermiso') === 'administrativo' && u.permiso === 'supervisor') ? '' : `<button class="btn btn-danger btn-sm" onclick="confirmarEliminarUsuario(${u.id}, '${u.nombre.replace(/'/g, "\\'")}')">Eliminar</button>`}
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarUsuarios() {
  const texto = document.getElementById('buscar-usuario').value.toLowerCase();
  const filtrados = usuariosCache.filter(u =>
    u.nombre.toLowerCase().includes(texto) || u.usuario.toLowerCase().includes(texto)
  );
  renderUsuarios(filtrados);
}

function mostrarFormUsuario() {
  document.getElementById('form-usuario-container').classList.remove('hidden');
  document.getElementById('form-usuario-titulo').textContent = 'Nuevo Usuario';
  document.getElementById('form-usuario').reset();
  document.getElementById('usr-edit-id').value = '';
  document.getElementById('usr-clave').setAttribute('required', 'required');
  document.getElementById('usr-clave').placeholder = 'Contraseña';
}

function cancelarFormUsuario() {
  document.getElementById('form-usuario-container').classList.add('hidden');
  document.getElementById('form-usuario').reset();
  document.getElementById('usr-edit-id').value = '';
}

function editarUsuario(id) {
  const u = usuariosCache.find(x => x.id === id);
  if (!u) return;
  document.getElementById('form-usuario-container').classList.remove('hidden');
  document.getElementById('form-usuario-titulo').textContent = 'Editar Usuario';
  document.getElementById('usr-edit-id').value = u.id;
  document.getElementById('usr-nombre').value = u.nombre;
  document.getElementById('usr-usuario').value = u.usuario;
  document.getElementById('usr-clave').value = '';
  document.getElementById('usr-clave').removeAttribute('required');
  document.getElementById('usr-clave').placeholder = 'Dejar vacío para mantener actual';
  document.getElementById('usr-estado').value = u.estado || 'activo';
  document.getElementById('usr-permiso').value = u.permiso || 'administrativo';
}

async function guardarUsuario(e) {
  e.preventDefault();
  const id = document.getElementById('usr-edit-id').value;
  const data = {
    nombre: document.getElementById('usr-nombre').value.trim(),
    usuario: document.getElementById('usr-usuario').value.trim(),
    clave: document.getElementById('usr-clave').value,
    estado: document.getElementById('usr-estado').value,
    permiso: document.getElementById('usr-permiso').value
  };

  if (!data.nombre || !data.usuario) {
    showToast('Nombre y usuario son obligatorios', 'error');
    return;
  }
  if (!id && !data.clave) {
    showToast('La contraseña es obligatoria para nuevos usuarios', 'error');
    return;
  }

  try {
    const url = id ? `${API}/api/admin/usuarios/${id}` : `${API}/api/admin/usuarios`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: headers(),
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    showToast(result.message);
    cancelarFormUsuario();
    cargarUsuarios();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmarEliminarUsuario(id, nombre) {
  const modal = document.getElementById('modal-confirm');
  document.getElementById('modal-titulo').textContent = 'Eliminar Usuario';
  document.getElementById('modal-mensaje').textContent = `¿Está seguro de eliminar al usuario "${nombre}"? Esta acción no se puede deshacer.`;
  document.getElementById('modal-confirmar').onclick = async () => {
    try {
      const res = await fetch(`${API}/api/admin/usuarios/${id}`, {
        method: 'DELETE',
        headers: headersAuth()
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      showToast(result.message);
      cargarUsuarios();
    } catch (err) {
      showToast(err.message, 'error');
    }
    cerrarModal();
  };
  modal.classList.remove('hidden');
}

// ==================== EMPLEADO - MIS DATOS ====================
let misDatosSelectsListos = false;

function opcionesLista(items, incluirOtro) {
  let html = '<option value="">Seleccionar...</option>';
  html += items.map(i => `<option value="${escAttr(i)}">${escAttr(i)}</option>`).join('');
  if (incluirOtro) html += `<option value="${VALOR_OTRO}">Otro (cargar manualmente)</option>`;
  return html;
}

function initMisDatosSelects() {
  if (misDatosSelectsListos) return;
  misDatosSelectsListos = true;

  document.getElementById('dato-nacionalidad').innerHTML = opcionesLista(PAISES_AMERICA, true);
  document.getElementById('dato-pais').innerHTML = opcionesLista(PAISES_AMERICA, true);
  document.getElementById('dato-provincia').innerHTML = opcionesLista(PROVINCIAS_ARG, false);
  document.getElementById('dato-grupo-sanguineo').innerHTML = opcionesLista(GRUPOS_SANGUINEOS, false);

  document.getElementById('carnet-clases').innerHTML = checkboxesClasesHTML('carnet-clase', []);
}

// Los selects de pais/nacionalidad admiten un valor libre cuando no es de America.
function toggleOtroPais(campo) {
  const sel = document.getElementById(`dato-${campo}`);
  const input = document.getElementById(`dato-${campo}-otro`);
  const esOtro = sel.value === VALOR_OTRO;
  input.classList.toggle('hidden', !esOtro);
  if (!esOtro) input.value = '';
}

function setSelectConOtro(campo, valor) {
  const sel = document.getElementById(`dato-${campo}`);
  const input = document.getElementById(`dato-${campo}-otro`);
  const v = valor || '';
  const enLista = Array.from(sel.options).some(o => o.value === v && o.value !== VALOR_OTRO);
  if (v && !enLista) {
    sel.value = VALOR_OTRO;
    input.value = v;
    input.classList.remove('hidden');
  } else {
    sel.value = v;
    input.value = '';
    input.classList.add('hidden');
  }
}

function getSelectConOtro(campo) {
  const sel = document.getElementById(`dato-${campo}`);
  if (sel.value === VALOR_OTRO) {
    return document.getElementById(`dato-${campo}-otro`).value.trim();
  }
  return sel.value;
}

function toggleCarnetConducir() {
  const tiene = document.getElementById('dato-carnet-conducir').value === 'SI';
  document.getElementById('carnet-detalle').classList.toggle('hidden', !tiene);
  if (!tiene) {
    document.querySelectorAll('.carnet-clase').forEach(c => c.checked = false);
    document.getElementById('dato-carnet-vencimiento').value = '';
    document.getElementById('dato-carnet-comentario').value = '';
  }
}

// ---------- Beneficiarios del seguro ----------
// La misma tabla se usa en el portal del empleado y en la ficha que edita el admin,
// por eso todo se parametriza con el id del tbody. El contador de total se deduce
// por convencion: tabla-beneficiarios[-x] -> beneficiarios-total[-x].
function idTotalBeneficiarios(tbodyId) {
  return tbodyId.replace('tabla-beneficiarios', 'beneficiarios-total');
}

function agregarBeneficiarioEn(tbodyId, b) {
  const datos = b || {};
  const tbody = document.getElementById(tbodyId);
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="ben-nombre" maxlength="200" value="${escAttr(mayus(datos.apellido_nombre))}" placeholder="Apellido y Nombre"></td>
    <td><input type="text" class="ben-parentesco" maxlength="60" value="${escAttr(mayus(datos.parentesco))}" placeholder="Ej: C&oacute;nyuge"></td>
    <td><input type="text" class="ben-dni" maxlength="20" value="${escAttr(datos.dni)}"></td>
    <td><input type="number" class="ben-porcentaje" min="0" max="100" step="0.01" value="${escAttr(datos.porcentaje !== undefined && datos.porcentaje !== null ? datos.porcentaje : '')}" oninput="actualizarTotalDe('${tbodyId}')"></td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="quitarBeneficiario(this)">Quitar</button></td>`;
  tbody.appendChild(tr);
  actualizarTotalDe(tbodyId);
}

function quitarBeneficiario(boton) {
  const tbody = boton.closest('tbody');
  boton.closest('tr').remove();
  actualizarTotalDe(tbody.id);
}

function actualizarTotalDe(tbodyId) {
  const el = document.getElementById(idTotalBeneficiarios(tbodyId));
  if (!el) return;
  const filas = document.querySelectorAll(`#${tbodyId} tr`).length;
  if (filas === 0) {
    el.textContent = '';
    el.classList.remove('total-excedido');
    return;
  }
  const total = Array.from(document.querySelectorAll(`#${tbodyId} .ben-porcentaje`))
    .reduce((acc, i) => acc + (parseFloat(i.value) || 0), 0);
  el.textContent = `Total asignado: ${total.toFixed(2)}%`;
  el.classList.toggle('total-excedido', total > 100);
}

function leerBeneficiariosDe(tbodyId) {
  return Array.from(document.querySelectorAll(`#${tbodyId} tr`)).map(tr => ({
    apellido_nombre: tr.querySelector('.ben-nombre').value.trim(),
    parentesco: tr.querySelector('.ben-parentesco').value.trim(),
    dni: tr.querySelector('.ben-dni').value.trim(),
    porcentaje: tr.querySelector('.ben-porcentaje').value
  })).filter(b => b.apellido_nombre);
}

// Envoltorios para el formulario del empleado, que los llama desde el HTML.
function agregarBeneficiario(b) { agregarBeneficiarioEn('tabla-beneficiarios', b); }
function actualizarTotalBeneficiarios() { actualizarTotalDe('tabla-beneficiarios'); }
function leerBeneficiarios() { return leerBeneficiariosDe('tabla-beneficiarios'); }

// ---------- Croquis del domicilio ----------
// El id del input sale de la clave del campo: croquis_calle_1 -> dato-croquis-calle-1.
function inputCroquis(campo) {
  return document.getElementById('dato-' + campo.k.replace(/_/g, '-'));
}

// Se redibuja entero en cada tecla: es un SVG chico y asi el empleado ve el nombre
// de la calle en el mismo lugar en el que va a salir impreso.
function dibujarCroquis() {
  const lienzo = document.getElementById('croquis-lienzo');
  if (!lienzo) return;
  const valores = {};
  CAMPOS_CROQUIS.forEach(c => {
    const el = inputCroquis(c);
    valores[c.k] = el ? el.value : '';
  });
  lienzo.innerHTML = croquisSVG(valores);
}

// ---------- Carga y guardado ----------
async function cargarMisDatos() {
  initMisDatosSelects();
  dibujarCroquis();
  try {
    const res = await fetch(`${API}/api/empleado/mis-datos`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al obtener sus datos');

    const d = data.datos || {};
    document.getElementById('dato-dni').value = data.dni || '';

    // Todo se precarga en mayuscula (asi lo guarda el servidor); solo el email va
    // en minuscula. El mayus() ademas hace que los registros viejos, cargados con
    // otra capitalizacion, sigan matcheando con las opciones de los selects.
    document.getElementById('dato-apellidos').value = mayus(d.apellidos);
    document.getElementById('dato-nombres').value = mayus(d.nombres);
    document.getElementById('dato-email').value = (d.email || '').toLowerCase();
    document.getElementById('dato-estado-civil').value = mayus(d.estado_civil);
    document.getElementById('dato-cuit').value = mayus(d.cuit);
    document.getElementById('dato-fecha-nacimiento').value = (d.fecha_nacimiento || '').substring(0, 10);
    document.getElementById('dato-sexo').value = mayus(d.sexo);
    document.getElementById('dato-grupo-sanguineo').value = mayus(d.grupo_sanguineo);
    setSelectConOtro('nacionalidad', mayus(d.nacionalidad));
    document.getElementById('dato-domicilio').value = mayus(d.domicilio);
    document.getElementById('dato-localidad').value = mayus(d.localidad);
    document.getElementById('dato-codigo-postal').value = mayus(d.codigo_postal);
    document.getElementById('dato-provincia').value = mayus(d.provincia);
    setSelectConOtro('pais', mayus(d.pais));
    document.getElementById('dato-obra-social').value = mayus(d.obra_social);

    document.getElementById('dato-carnet-conducir').value = mayus(d.carnet_conducir);
    // Se re-renderiza en vez de solo tildar, asi las clases del listado anterior
    // aparecen igual y no se pierden al guardar.
    const clases = mayus(d.carnet_clases).split(',').map(c => c.trim()).filter(Boolean);
    document.getElementById('carnet-clases').innerHTML = checkboxesClasesHTML('carnet-clase', clases);
    document.getElementById('dato-carnet-vencimiento').value = (d.carnet_vencimiento || '').substring(0, 10);
    document.getElementById('dato-carnet-comentario').value = mayus(d.carnet_comentario);
    document.getElementById('carnet-detalle').classList.toggle('hidden', mayus(d.carnet_conducir) !== 'SI');

    document.getElementById('dato-nivel-estudio').value = mayus(d.nivel_estudio);
    document.getElementById('dato-profesion').value = mayus(d.profesion);
    document.getElementById('dato-apellido-conyuge').value = mayus(d.apellido_conyuge);
    document.getElementById('dato-nombre-conyuge').value = mayus(d.nombre_conyuge);
    document.getElementById('dato-cantidad-hijos').value = d.cantidad_hijos !== undefined && d.cantidad_hijos !== null ? d.cantidad_hijos : 0;
    document.getElementById('dato-banco').value = mayus(d.banco);
    document.getElementById('dato-cbu').value = mayus(d.cbu);
    document.getElementById('dato-nro-cuenta').value = mayus(d.nro_cuenta);
    document.getElementById('dato-tel-fijo').value = mayus(d.tel_fijo);
    document.getElementById('dato-celular-empleado').value = mayus(d.celular_empleado);
    document.getElementById('dato-celular-conyuge').value = mayus(d.celular_conyuge);
    document.getElementById('dato-talle-camisa').value = mayus(d.talle_camisa);
    document.getElementById('dato-talle-pantalon').value = mayus(d.talle_pantalon);
    document.getElementById('dato-talle-zapato').value = mayus(d.talle_zapato);
    document.getElementById('dato-talle-mameluco').value = mayus(d.talle_mameluco);

    CAMPOS_CROQUIS.forEach(c => { inputCroquis(c).value = mayus(d[c.k]); });
    dibujarCroquis();

    document.getElementById('tabla-beneficiarios').innerHTML = '';
    (data.beneficiarios || []).forEach(b => agregarBeneficiario(b));
    actualizarTotalBeneficiarios();

    document.getElementById('datos-fecha-texto').textContent = d.updated_at
      ? 'Ultima actualizacion: ' + new Date(d.updated_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function guardarMisDatos(e) {
  e.preventDefault();

  const clases = Array.from(document.querySelectorAll('.carnet-clase:checked')).map(c => c.value).join(', ');
  const carnet = document.getElementById('dato-carnet-conducir').value;

  const payload = {
    dni: document.getElementById('dato-dni').value.trim(),
    apellidos: document.getElementById('dato-apellidos').value.trim(),
    nombres: document.getElementById('dato-nombres').value.trim(),
    email: document.getElementById('dato-email').value.trim(),
    estado_civil: document.getElementById('dato-estado-civil').value,
    cuit: document.getElementById('dato-cuit').value.trim(),
    fecha_nacimiento: document.getElementById('dato-fecha-nacimiento').value,
    sexo: document.getElementById('dato-sexo').value,
    grupo_sanguineo: document.getElementById('dato-grupo-sanguineo').value,
    nacionalidad: getSelectConOtro('nacionalidad'),
    domicilio: document.getElementById('dato-domicilio').value.trim(),
    localidad: document.getElementById('dato-localidad').value.trim(),
    codigo_postal: document.getElementById('dato-codigo-postal').value.trim(),
    provincia: document.getElementById('dato-provincia').value,
    pais: getSelectConOtro('pais'),
    obra_social: document.getElementById('dato-obra-social').value,
    carnet_conducir: carnet,
    carnet_clases: carnet === 'SI' ? clases : '',
    carnet_vencimiento: carnet === 'SI' ? document.getElementById('dato-carnet-vencimiento').value : '',
    carnet_comentario: carnet === 'SI' ? document.getElementById('dato-carnet-comentario').value.trim() : '',
    nivel_estudio: document.getElementById('dato-nivel-estudio').value,
    profesion: document.getElementById('dato-profesion').value.trim(),
    apellido_conyuge: document.getElementById('dato-apellido-conyuge').value.trim(),
    nombre_conyuge: document.getElementById('dato-nombre-conyuge').value.trim(),
    cantidad_hijos: document.getElementById('dato-cantidad-hijos').value,
    banco: document.getElementById('dato-banco').value.trim(),
    cbu: document.getElementById('dato-cbu').value.trim(),
    nro_cuenta: document.getElementById('dato-nro-cuenta').value.trim(),
    tel_fijo: document.getElementById('dato-tel-fijo').value.trim(),
    celular_empleado: document.getElementById('dato-celular-empleado').value.trim(),
    celular_conyuge: document.getElementById('dato-celular-conyuge').value.trim(),
    talle_camisa: document.getElementById('dato-talle-camisa').value.trim(),
    talle_pantalon: document.getElementById('dato-talle-pantalon').value.trim(),
    talle_zapato: document.getElementById('dato-talle-zapato').value.trim(),
    talle_mameluco: document.getElementById('dato-talle-mameluco').value.trim(),
    beneficiarios: leerBeneficiarios()
  };
  CAMPOS_CROQUIS.forEach(c => { payload[c.k] = inputCroquis(c).value.trim(); });

  try {
    const res = await fetch(`${API}/api/empleado/mis-datos`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error);
    showToast(data.message);
    cargarMisDatos();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== EMPLEADO PORTAL ====================
let recibosEmpleadoCache = [];

async function cargarRecibosEmpleado() {
  try {
    const res = await fetch(`${API}/api/empleado/recibos`, { headers: headersAuth() });
    const recibos = await res.json();
    recibosEmpleadoCache = recibos;
    const container = document.getElementById('recibos-empleado');
    const emptyState = document.getElementById('empleado-sin-recibos');

    if (recibos.length === 0) {
      container.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');
    container.innerHTML = recibos.map(r => `
      <div class="recibo-card">
        <div class="recibo-card-header">
          <div class="recibo-fecha">${formatFecha(r.fecha_recibo)}</div>
          <span class="firma-circulo ${r.firmado ? 'firma-si' : 'firma-no'}" title="${r.firmado ? 'Firmado' : 'Sin firmar'}"></span>
        </div>
        <div class="recibo-archivo">${r.archivo_nombre}</div>
        <div class="recibo-desc">${r.descripcion || ''}</div>
        ${r.firmado
          ? `<div class="firma-estado firmado">Firmado el ${new Date(r.fecha_firma).toLocaleDateString('es-AR')}</div>
             <button class="btn btn-primary btn-sm" onclick="descargarRecibo(${r.id})">Descargar PDF</button>`
          : `<button class="btn btn-primary btn-sm" onclick="descargarRecibo(${r.id})">Firmar y Descargar PDF</button>`
        }
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}
