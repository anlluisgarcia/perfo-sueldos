require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool;

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4'
};

// Wrapper con la misma forma que sql.js: exec() devuelve [{columns, values}]
// para minimizar cambios en server.js.
const dbWrapper = {
  async exec(sql, params = []) {
    const [result] = await pool.query(sql, params);
    if (!Array.isArray(result)) return [];
    if (result.length === 0) return [];
    const columns = Object.keys(result[0]);
    const values = result.map(row => columns.map(c => row[c]));
    return [{ columns, values }];
  },
  async run(sql, params = []) {
    const [result] = await pool.query(sql, params);
    return result;
  }
};

async function columnaExiste(tabla, columna) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  return rows[0].c > 0;
}

async function longitudColumna(tabla, columna) {
  const [rows] = await pool.query(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS largo FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  return rows.length > 0 ? rows[0].largo : null;
}

async function ensureSchema() {
  // administradores
  await pool.query(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario VARCHAR(100) NOT NULL UNIQUE,
      clave VARCHAR(255) NOT NULL,
      nombre VARCHAR(200) NOT NULL,
      estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
      permiso ENUM('administrativo','supervisor','operador') NOT NULL DEFAULT 'administrativo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // empleados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empleados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(200) NOT NULL,
      dni VARCHAR(20) NOT NULL UNIQUE,
      clave VARCHAR(255) NOT NULL,
      telefono VARCHAR(50) DEFAULT '',
      direccion VARCHAR(255) DEFAULT '',
      empresa VARCHAR(200) DEFAULT '',
      estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // recibos
  // empresa es una foto del momento de la carga: si despues se cambia la empresa
  // del empleado, los recibos ya subidos conservan la que tenian.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recibos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleado_id INT NOT NULL,
      empresa VARCHAR(200) NOT NULL DEFAULT '',
      fecha_recibo VARCHAR(20) NOT NULL,
      archivo_nombre VARCHAR(255) NOT NULL,
      archivo_path VARCHAR(255) NOT NULL,
      descripcion TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_empleado (empleado_id),
      CONSTRAINT fk_recibos_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migracion para bases ya creadas: agrega recibos.empresa y la completa con la
  // empresa actual del empleado, que es el mejor dato disponible para el historico.
  if (!(await columnaExiste('recibos', 'empresa'))) {
    await pool.query("ALTER TABLE recibos ADD COLUMN empresa VARCHAR(200) NOT NULL DEFAULT '' AFTER empleado_id");
    const [r] = await pool.query(`
      UPDATE recibos r
      JOIN empleados e ON e.id = r.empleado_id
      SET r.empresa = COALESCE(e.empresa, '')
    `);
    console.log(`Columna recibos.empresa agregada. Recibos actualizados: ${r.affectedRows}`);
  }

  // firmas_empleados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS firmas_empleados (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleado_id INT NOT NULL UNIQUE,
      firma_data LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_firmas_emp_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // firmas_recibos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS firmas_recibos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recibo_id INT NOT NULL,
      empleado_id INT NOT NULL,
      firma_data LONGTEXT NOT NULL,
      fecha_firma DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_recibo_emp (recibo_id, empleado_id),
      CONSTRAINT fk_firmas_rec_rec FOREIGN KEY (recibo_id) REFERENCES recibos(id),
      CONSTRAINT fk_firmas_rec_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // descargas_recibos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS descargas_recibos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recibo_id INT NOT NULL,
      empleado_id INT NOT NULL,
      fecha_descarga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_descargas_rec (recibo_id),
      CONSTRAINT fk_desc_rec FOREIGN KEY (recibo_id) REFERENCES recibos(id),
      CONSTRAINT fk_desc_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // empleados_datos (ficha personal que completa el propio empleado)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empleados_datos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleado_id INT NOT NULL UNIQUE,
      apellidos VARCHAR(150) NOT NULL DEFAULT '',
      nombres VARCHAR(150) NOT NULL DEFAULT '',
      email VARCHAR(150) NOT NULL DEFAULT '',
      estado_civil VARCHAR(30) NOT NULL DEFAULT '',
      cuit VARCHAR(20) NOT NULL DEFAULT '',
      fecha_nacimiento DATE NULL,
      sexo VARCHAR(20) NOT NULL DEFAULT '',
      grupo_sanguineo VARCHAR(10) NOT NULL DEFAULT '',
      nacionalidad VARCHAR(100) NOT NULL DEFAULT '',
      domicilio VARCHAR(200) NOT NULL DEFAULT '',
      localidad VARCHAR(120) NOT NULL DEFAULT '',
      codigo_postal VARCHAR(20) NOT NULL DEFAULT '',
      provincia VARCHAR(100) NOT NULL DEFAULT '',
      pais VARCHAR(100) NOT NULL DEFAULT '',
      obra_social VARCHAR(5) NOT NULL DEFAULT '',
      carnet_conducir VARCHAR(5) NOT NULL DEFAULT '',
      carnet_clases VARCHAR(255) NOT NULL DEFAULT '',
      carnet_comentario TEXT,
      nivel_estudio VARCHAR(60) NOT NULL DEFAULT '',
      profesion VARCHAR(120) NOT NULL DEFAULT '',
      apellido_conyuge VARCHAR(150) NOT NULL DEFAULT '',
      nombre_conyuge VARCHAR(150) NOT NULL DEFAULT '',
      cantidad_hijos INT NOT NULL DEFAULT 0,
      banco VARCHAR(120) NOT NULL DEFAULT '',
      cbu VARCHAR(30) NOT NULL DEFAULT '',
      tel_fijo VARCHAR(50) NOT NULL DEFAULT '',
      celular_empleado VARCHAR(50) NOT NULL DEFAULT '',
      celular_conyuge VARCHAR(50) NOT NULL DEFAULT '',
      talle_camisa VARCHAR(20) NOT NULL DEFAULT '',
      talle_pantalon VARCHAR(20) NOT NULL DEFAULT '',
      talle_zapato VARCHAR(20) NOT NULL DEFAULT '',
      talle_mameluco VARCHAR(20) NOT NULL DEFAULT '',
      croquis_calle_1 VARCHAR(120) NOT NULL DEFAULT '',
      croquis_calle_2 VARCHAR(120) NOT NULL DEFAULT '',
      croquis_calle_3 VARCHAR(120) NOT NULL DEFAULT '',
      croquis_calle_4 VARCHAR(120) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_datos_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Migracion: con todas las categorias del carnet (incluidas las profesionales)
  // los 120 caracteres originales pueden quedar cortos.
  if ((await longitudColumna('empleados_datos', 'carnet_clases')) < 255) {
    await pool.query("ALTER TABLE empleados_datos MODIFY carnet_clases VARCHAR(255) NOT NULL DEFAULT ''");
    console.log('Columna empleados_datos.carnet_clases ampliada a 255 caracteres');
  }

  // Migracion: las cuatro calles que rodean la manzana del domicilio (croquis).
  for (const col of ['croquis_calle_1', 'croquis_calle_2', 'croquis_calle_3', 'croquis_calle_4']) {
    if (!(await columnaExiste('empleados_datos', col))) {
      await pool.query(`ALTER TABLE empleados_datos ADD COLUMN ${col} VARCHAR(120) NOT NULL DEFAULT ''`);
      console.log(`Columna empleados_datos.${col} agregada`);
    }
  }

  // empleados_beneficiarios (beneficiarios del seguro, varios por empleado)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS empleados_beneficiarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleado_id INT NOT NULL,
      apellido_nombre VARCHAR(200) NOT NULL,
      parentesco VARCHAR(60) NOT NULL DEFAULT '',
      dni VARCHAR(20) NOT NULL DEFAULT '',
      porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_benef_emp (empleado_id),
      CONSTRAINT fk_benef_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // firma_admin (fila única id=1)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS firma_admin (
      id INT PRIMARY KEY,
      firma_data LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureDefaultAdmin() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM administradores');
  if (rows[0].c === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query(
      'INSERT INTO administradores (usuario, clave, nombre, estado, permiso) VALUES (?, ?, ?, ?, ?)',
      ['admin', hash, 'Administrador', 'activo', 'administrativo']
    );
    console.log('Admin por defecto creado: admin / admin123');
  }
}

async function initDatabase() {
  if (!DB_CONFIG.user || !DB_CONFIG.password || !DB_CONFIG.database) {
    throw new Error('Faltan variables de entorno DB_USER / DB_PASS / DB_NAME');
  }
  pool = mysql.createPool(DB_CONFIG);
  await pool.query('SELECT 1');
  await ensureSchema();
  await ensureDefaultAdmin();
  console.log(`Conectado a MySQL: ${DB_CONFIG.user}@${DB_CONFIG.host}/${DB_CONFIG.database}`);
  return dbWrapper;
}

function getDb() {
  return dbWrapper;
}

// No-op: MySQL persiste automáticamente. Se mantiene para compatibilidad
// con llamadas existentes en server.js.
async function saveDatabase() {}

function getPool() {
  return pool;
}

module.exports = { initDatabase, getDb, saveDatabase, getPool };
