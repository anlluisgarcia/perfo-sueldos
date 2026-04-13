/**
 * Genera un archivo dump_mysql.sql a partir de data/recibos.db (SQLite).
 * El SQL resultante se puede importar por phpMyAdmin a la base MySQL
 * de cPanel, sin necesidad de Terminal ni conexión remota.
 *
 * Uso local (en tu PC):
 *   node generar_dump_sql.js
 *
 * Luego: subir dump_mysql.sql a phpMyAdmin → pestaña "Importar".
 */
const fs = require('fs');
const path = require('path');
const initSQL = require('sql.js');

const SQLITE_PATH = path.join(__dirname, 'data', 'recibos.db');
const OUT_PATH = path.join(__dirname, 'dump_mysql.sql');

const TABLAS = [
  'administradores',
  'empleados',
  'recibos',
  'firmas_empleados',
  'firmas_recibos',
  'descargas_recibos',
  'firma_admin'
];

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? '1' : '0';
  // String: escapar comillas y backslashes
  const s = String(v)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\x1a/g, '\\Z')
    .replace(/\x00/g, '\\0');
  return `'${s}'`;
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`No se encontró ${SQLITE_PATH}`);
    process.exit(1);
  }

  const SQL = await initSQL();
  const buffer = fs.readFileSync(SQLITE_PATH);
  const sdb = new SQL.Database(buffer);

  const out = fs.createWriteStream(OUT_PATH);
  out.write('-- Dump generado desde SQLite para importar en MySQL (cPanel phpMyAdmin)\n\n');
  out.write('SET FOREIGN_KEY_CHECKS=0;\n');
  out.write('SET NAMES utf8mb4;\n\n');

  // Esquema MySQL (idéntico al de database.js)
  out.write(`CREATE TABLE IF NOT EXISTS administradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario VARCHAR(100) NOT NULL UNIQUE,
  clave VARCHAR(255) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  estado ENUM('activo','inactivo') NOT NULL DEFAULT 'activo',
  permiso ENUM('administrativo','supervisor','operador') NOT NULL DEFAULT 'administrativo',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS firmas_empleados (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empleado_id INT NOT NULL UNIQUE,
  firma_data LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_firmas_emp_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS firmas_recibos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recibo_id INT NOT NULL,
  empleado_id INT NOT NULL,
  firma_data LONGTEXT NOT NULL,
  fecha_firma DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_recibo_emp (recibo_id, empleado_id),
  CONSTRAINT fk_firmas_rec_rec FOREIGN KEY (recibo_id) REFERENCES recibos(id),
  CONSTRAINT fk_firmas_rec_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS descargas_recibos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recibo_id INT NOT NULL,
  empleado_id INT NOT NULL,
  fecha_descarga DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_descargas_rec (recibo_id),
  CONSTRAINT fk_desc_rec FOREIGN KEY (recibo_id) REFERENCES recibos(id),
  CONSTRAINT fk_desc_emp FOREIGN KEY (empleado_id) REFERENCES empleados(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS firma_admin (
  id INT PRIMARY KEY,
  firma_data LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

`);


  // Vaciar tablas destino en orden inverso
  for (const t of [...TABLAS].reverse()) {
    out.write(`DELETE FROM \`${t}\`;\n`);
  }
  out.write('\n');

  for (const tabla of TABLAS) {
    let res;
    try {
      res = sdb.exec(`SELECT * FROM ${tabla}`);
    } catch (e) {
      console.log(`Tabla ${tabla} no existe en SQLite, salteando.`);
      continue;
    }
    if (res.length === 0) {
      console.log(`${tabla}: 0 filas`);
      continue;
    }
    const cols = res[0].columns;
    const rows = res[0].values;
    console.log(`${tabla}: ${rows.length} filas`);

    out.write(`-- ${tabla} (${rows.length} filas)\n`);
    const colsList = cols.map(c => `\`${c}\``).join(', ');
    const LOTE = 100;
    for (let i = 0; i < rows.length; i += LOTE) {
      const chunk = rows.slice(i, i + LOTE);
      const valores = chunk.map(r => '(' + r.map(esc).join(', ') + ')').join(',\n  ');
      out.write(`INSERT INTO \`${tabla}\` (${colsList}) VALUES\n  ${valores};\n`);
    }
    out.write('\n');
  }

  out.write('SET FOREIGN_KEY_CHECKS=1;\n');
  out.end();

  out.on('finish', () => {
    console.log(`\nArchivo generado: ${OUT_PATH}`);
    console.log('Subilo a phpMyAdmin → Importar.');
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
