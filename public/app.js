const API = '';
let token = '';
let userRole = '';
let empleadosCache = [];

// ==================== UTILIDADES ====================
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

  // Ocultar tab "Alta Usuario" para operadores
  const permiso = localStorage.getItem('userPermiso');
  const tabUsuarios = document.querySelector('.admin-tab[onclick*="usuarios"]');
  if (permiso === 'operador' && tabUsuarios) {
    tabUsuarios.style.display = 'none';
  } else if (tabUsuarios) {
    tabUsuarios.style.display = '';
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
        <button class="btn btn-outline btn-sm" onclick="verDatosEmpleado(${emp.id})">Ver Datos</button>
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

// ==================== ADMIN - VER DATOS DEL EMPLEADO ====================
// Vista de solo lectura de la ficha que el empleado completa en "Mis Datos".
const SECCIONES_DATOS = [
  ['Datos personales', [
    ['Apellidos', 'apellidos'], ['Nombres', 'nombres'], ['Email', 'email'],
    ['Estado Civil', 'estado_civil'], ['DNI', 'dni'], ['CUIT', 'cuit'],
    ['Fecha de Nacimiento', 'fecha_nacimiento'], ['Sexo', 'sexo'],
    ['Grupo Sanguíneo', 'grupo_sanguineo'], ['Nacionalidad', 'nacionalidad']
  ]],
  ['Domicilio', [
    ['Domicilio', 'domicilio'], ['Localidad', 'localidad'],
    ['Código Postal', 'codigo_postal'], ['Provincia', 'provincia'],
    ['País', 'pais'], ['Obra Social', 'obra_social']
  ]],
  ['Carnet de conducir y estudios', [
    ['Carnet de Conducción', 'carnet_conducir'], ['Clases', 'carnet_clases'],
    ['Comentario', 'carnet_comentario'], ['Nivel de Estudio', 'nivel_estudio'],
    ['Profesión', 'profesion']
  ]],
  ['Grupo familiar', [
    ['Apellido del Cónyuge', 'apellido_conyuge'], ['Nombre del Cónyuge', 'nombre_conyuge'],
    ['Cantidad de Hijos', 'cantidad_hijos']
  ]],
  ['Datos bancarios', [['Banco', 'banco'], ['CBU', 'cbu']]],
  ['Contacto', [
    ['Tel. Fijo', 'tel_fijo'], ['Celular Empleado', 'celular_empleado'],
    ['Celular Cónyuge', 'celular_conyuge']
  ]],
  ['Ropa de Trabajo (Talles)', [
    ['Camisa', 'talle_camisa'], ['Pantalón', 'talle_pantalon'],
    ['Zapato', 'talle_zapato'], ['Mameluco', 'talle_mameluco']
  ]]
];

function formatFechaCorta(fecha) {
  if (!fecha) return '';
  const partes = String(fecha).substring(0, 10).split('-');
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
}

async function verDatosEmpleado(id) {
  const modal = document.getElementById('modal-datos-empleado');
  const cuerpo = document.getElementById('modal-datos-cuerpo');
  cuerpo.innerHTML = '<p class="datos-cargando">Cargando...</p>';
  document.getElementById('modal-datos-subtitulo').textContent = '';
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`${API}/api/admin/empleados/${id}/datos`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al obtener los datos');

    document.getElementById('modal-datos-subtitulo').textContent =
      `${data.nombre} · DNI ${data.dni}${data.empresa ? ' · ' + data.empresa : ''}`;

    if (!data.datos) {
      cuerpo.innerHTML = '<div class="info-box">El empleado a&uacute;n no complet&oacute; su ficha de datos personales.</div>';
      return;
    }

    // El DNI se toma del alta de usuario, no de la ficha.
    const d = Object.assign({}, data.datos, { dni: data.dni });
    d.fecha_nacimiento = formatFechaCorta(d.fecha_nacimiento);

    let html = SECCIONES_DATOS.map(([titulo, campos]) => `
      <h4 class="datos-seccion">${titulo}</h4>
      <div class="datos-grid">
        ${campos.map(([etiqueta, campo]) => `
          <div class="datos-item">
            <span class="datos-label">${etiqueta}</span>
            <span class="datos-valor">${escAttr(d[campo] !== null && d[campo] !== undefined && d[campo] !== '' ? d[campo] : '-')}</span>
          </div>`).join('')}
      </div>`).join('');

    const benef = data.beneficiarios || [];
    html += '<h4 class="datos-seccion">Beneficiarios del Seguro</h4>';
    if (benef.length === 0) {
      html += '<p class="datos-vacio">Sin beneficiarios cargados.</p>';
    } else {
      const total = benef.reduce((acc, b) => acc + (parseFloat(b.porcentaje) || 0), 0);
      html += `
        <div class="table-responsive">
          <table>
            <thead>
              <tr><th>Apellido y Nombre</th><th>Parentesco</th><th>DNI</th><th>Porcentaje</th></tr>
            </thead>
            <tbody>
              ${benef.map(b => `
                <tr>
                  <td>${escAttr(b.apellido_nombre)}</td>
                  <td>${escAttr(b.parentesco || '-')}</td>
                  <td>${escAttr(b.dni || '-')}</td>
                  <td>${(parseFloat(b.porcentaje) || 0).toFixed(2)}%</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <p class="beneficiarios-total" style="margin-top:10px">Total asignado: ${total.toFixed(2)}%</p>`;
    }

    if (d.updated_at) {
      html += `<p class="firma-fecha-guardada">Ultima actualizacion: ${new Date(d.updated_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>`;
    }

    cuerpo.innerHTML = html;
  } catch (err) {
    cuerpo.innerHTML = `<div class="info-box">${escAttr(err.message)}</div>`;
  }
}

function cerrarModalDatosEmpleado() {
  document.getElementById('modal-datos-empleado').classList.add('hidden');
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

function renderFichas(fichas) {
  const tbody = document.getElementById('tabla-fichas');
  if (fichas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray-500);padding:40px">No hay empleados que coincidan con el filtro</td></tr>';
    return;
  }
  tbody.innerHTML = fichas.map(f => `
    <tr>
      <td><strong>${escAttr(nombreFicha(f))}</strong></td>
      <td>${escAttr(f.dni)}</td>
      <td>${escAttr(f.cuit || '-')}</td>
      <td>${escAttr(f.email || '-')}</td>
      <td>${escAttr(f.celular_empleado || '-')}</td>
      <td>${escAttr(f.localidad || '-')}</td>
      <td>
        <select class="select-empresa" onchange="asignarEmpresaFicha(${f.id}, this)">
          <option value=""${!f.empresa ? ' selected' : ''}>Sin asignar</option>
          ${EMPRESAS.map(e => `<option value="${escAttr(e)}"${f.empresa === e ? ' selected' : ''}>${escAttr(e)}</option>`).join('')}
        </select>
      </td>
      <td><span class="badge ${f.tiene_ficha ? 'badge-success' : 'badge-warning'}">${f.tiene_ficha ? 'Cargada' : 'Pendiente'}</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="verDatosEmpleado(${f.id})">Ver Datos</button></td>
    </tr>
  `).join('');
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
// Argentina va primero por ser el caso mas frecuente; el resto en orden alfabetico.
const PAISES_AMERICA = [
  'Argentina', 'Antigua y Barbuda', 'Bahamas', 'Barbados', 'Belice', 'Bolivia', 'Brasil',
  'Canadá', 'Chile', 'Colombia', 'Costa Rica', 'Cuba', 'Dominica', 'Ecuador',
  'El Salvador', 'Estados Unidos', 'Granada', 'Guatemala', 'Guyana', 'Haití', 'Honduras',
  'Jamaica', 'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú',
  'República Dominicana', 'San Cristóbal y Nieves', 'San Vicente y las Granadinas',
  'Santa Lucía', 'Surinam', 'Trinidad y Tobago', 'Uruguay', 'Venezuela'
];

const PROVINCIAS_ARG = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

const GRUPOS_SANGUINEOS = ['0-', '0+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

const CLASES_CARNET = [
  { valor: 'A', texto: 'A - Motocicletas y ciclomotores' },
  { valor: 'B', texto: 'B - Automóviles y camionetas' },
  { valor: 'C', texto: 'C - Camiones sin acoplado' },
  { valor: 'D', texto: 'D - Servicio de transporte de pasajeros' },
  { valor: 'E', texto: 'E - Camiones con acoplado y maquinaria especial' },
  { valor: 'F', texto: 'F - Vehículos adaptados para personas con discapacidad' },
  { valor: 'G', texto: 'G - Tractores y maquinaria agrícola' }
];

const VALOR_OTRO = '__otro__';
let misDatosSelectsListos = false;

function escAttr(valor) {
  return String(valor === undefined || valor === null ? '' : valor)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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

  document.getElementById('carnet-clases').innerHTML = CLASES_CARNET.map(c => `
    <label class="checkbox-item">
      <input type="checkbox" class="carnet-clase" value="${escAttr(c.valor)}">
      <span>${escAttr(c.texto)}</span>
    </label>`).join('');
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
    document.getElementById('dato-carnet-comentario').value = '';
  }
}

// ---------- Beneficiarios del seguro ----------
function agregarBeneficiario(b) {
  const datos = b || {};
  const tbody = document.getElementById('tabla-beneficiarios');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="ben-nombre" maxlength="200" value="${escAttr(datos.apellido_nombre)}" placeholder="Apellido y Nombre"></td>
    <td><input type="text" class="ben-parentesco" maxlength="60" value="${escAttr(datos.parentesco)}" placeholder="Ej: C&oacute;nyuge"></td>
    <td><input type="text" class="ben-dni" maxlength="20" value="${escAttr(datos.dni)}"></td>
    <td><input type="number" class="ben-porcentaje" min="0" max="100" step="0.01" value="${escAttr(datos.porcentaje !== undefined && datos.porcentaje !== null ? datos.porcentaje : '')}" oninput="actualizarTotalBeneficiarios()"></td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="quitarBeneficiario(this)">Quitar</button></td>`;
  tbody.appendChild(tr);
  actualizarTotalBeneficiarios();
}

function quitarBeneficiario(boton) {
  boton.closest('tr').remove();
  actualizarTotalBeneficiarios();
}

function actualizarTotalBeneficiarios() {
  const total = Array.from(document.querySelectorAll('#tabla-beneficiarios .ben-porcentaje'))
    .reduce((acc, i) => acc + (parseFloat(i.value) || 0), 0);
  const el = document.getElementById('beneficiarios-total');
  const filas = document.querySelectorAll('#tabla-beneficiarios tr').length;
  if (filas === 0) {
    el.textContent = '';
    el.classList.remove('total-excedido');
    return;
  }
  el.textContent = `Total asignado: ${total.toFixed(2)}%`;
  el.classList.toggle('total-excedido', total > 100);
}

function leerBeneficiarios() {
  return Array.from(document.querySelectorAll('#tabla-beneficiarios tr')).map(tr => ({
    apellido_nombre: tr.querySelector('.ben-nombre').value.trim(),
    parentesco: tr.querySelector('.ben-parentesco').value.trim(),
    dni: tr.querySelector('.ben-dni').value.trim(),
    porcentaje: tr.querySelector('.ben-porcentaje').value
  })).filter(b => b.apellido_nombre);
}

// ---------- Carga y guardado ----------
async function cargarMisDatos() {
  initMisDatosSelects();
  try {
    const res = await fetch(`${API}/api/empleado/mis-datos`, { headers: headersAuth() });
    const data = await leerJson(res);
    if (!res.ok) throw new Error(data.error || 'Error al obtener sus datos');

    const d = data.datos || {};
    document.getElementById('dato-dni').value = data.dni || '';

    document.getElementById('dato-apellidos').value = d.apellidos || '';
    document.getElementById('dato-nombres').value = d.nombres || '';
    document.getElementById('dato-email').value = d.email || '';
    document.getElementById('dato-estado-civil').value = d.estado_civil || '';
    document.getElementById('dato-cuit').value = d.cuit || '';
    document.getElementById('dato-fecha-nacimiento').value = (d.fecha_nacimiento || '').substring(0, 10);
    document.getElementById('dato-sexo').value = d.sexo || '';
    document.getElementById('dato-grupo-sanguineo').value = d.grupo_sanguineo || '';
    setSelectConOtro('nacionalidad', d.nacionalidad);
    document.getElementById('dato-domicilio').value = d.domicilio || '';
    document.getElementById('dato-localidad').value = d.localidad || '';
    document.getElementById('dato-codigo-postal').value = d.codigo_postal || '';
    document.getElementById('dato-provincia').value = d.provincia || '';
    setSelectConOtro('pais', d.pais);
    document.getElementById('dato-obra-social').value = d.obra_social || '';

    document.getElementById('dato-carnet-conducir').value = d.carnet_conducir || '';
    const clases = (d.carnet_clases || '').split(',').map(c => c.trim()).filter(Boolean);
    document.querySelectorAll('.carnet-clase').forEach(c => c.checked = clases.includes(c.value));
    document.getElementById('dato-carnet-comentario').value = d.carnet_comentario || '';
    document.getElementById('carnet-detalle').classList.toggle('hidden', d.carnet_conducir !== 'SI');

    document.getElementById('dato-nivel-estudio').value = d.nivel_estudio || '';
    document.getElementById('dato-profesion').value = d.profesion || '';
    document.getElementById('dato-apellido-conyuge').value = d.apellido_conyuge || '';
    document.getElementById('dato-nombre-conyuge').value = d.nombre_conyuge || '';
    document.getElementById('dato-cantidad-hijos').value = d.cantidad_hijos !== undefined && d.cantidad_hijos !== null ? d.cantidad_hijos : 0;
    document.getElementById('dato-banco').value = d.banco || '';
    document.getElementById('dato-cbu').value = d.cbu || '';
    document.getElementById('dato-tel-fijo').value = d.tel_fijo || '';
    document.getElementById('dato-celular-empleado').value = d.celular_empleado || '';
    document.getElementById('dato-celular-conyuge').value = d.celular_conyuge || '';
    document.getElementById('dato-talle-camisa').value = d.talle_camisa || '';
    document.getElementById('dato-talle-pantalon').value = d.talle_pantalon || '';
    document.getElementById('dato-talle-zapato').value = d.talle_zapato || '';
    document.getElementById('dato-talle-mameluco').value = d.talle_mameluco || '';

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
    carnet_comentario: carnet === 'SI' ? document.getElementById('dato-carnet-comentario').value.trim() : '',
    nivel_estudio: document.getElementById('dato-nivel-estudio').value,
    profesion: document.getElementById('dato-profesion').value.trim(),
    apellido_conyuge: document.getElementById('dato-apellido-conyuge').value.trim(),
    nombre_conyuge: document.getElementById('dato-nombre-conyuge').value.trim(),
    cantidad_hijos: document.getElementById('dato-cantidad-hijos').value,
    banco: document.getElementById('dato-banco').value.trim(),
    cbu: document.getElementById('dato-cbu').value.trim(),
    tel_fijo: document.getElementById('dato-tel-fijo').value.trim(),
    celular_empleado: document.getElementById('dato-celular-empleado').value.trim(),
    celular_conyuge: document.getElementById('dato-celular-conyuge').value.trim(),
    talle_camisa: document.getElementById('dato-talle-camisa').value.trim(),
    talle_pantalon: document.getElementById('dato-talle-pantalon').value.trim(),
    talle_zapato: document.getElementById('dato-talle-zapato').value.trim(),
    talle_mameluco: document.getElementById('dato-talle-mameluco').value.trim(),
    beneficiarios: leerBeneficiarios()
  };

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
