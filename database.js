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
  await pool.query(`
    CREATE TABLE IF NOT EXISTS recibos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      empleado_id INT NOT NULL,
      fecha_recibo VARCHAR(20) NOT NULL,
      archivo_nombre VARCHAR(255) NOT NULL,
      archivo_path VARCHAR(255) NOT NULL,
      descripcion TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_empleado (empleado_id),
      CONSTRAINT fk_recibos_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

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
