/**
 * Script de migración one-shot: lee data/recibos.db (SQLite/sql.js)
 * y vuelca todas las tablas a la base MySQL configurada en .env.
 *
 * Uso: node migrar_a_mysql.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const initSQL = require('sql.js');
const mysql = require('mysql2/promise');
const { initDatabase, getPool } = require('./database');

const SQLITE_PATH = path.join(__dirname, 'data', 'recibos.db');

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`No se encontró ${SQLITE_PATH}. Copiá el archivo data/recibos.db al servidor antes de migrar.`);
    process.exit(1);
  }

  console.log('Inicializando MySQL (crea tablas si no existen)...');
  await initDatabase();
  const pool = getPool();

  console.log('Cargando SQLite...');
  const SQL = await initSQL();
  const buffer = fs.readFileSync(SQLITE_PATH);
  const sdb = new SQL.Database(buffer);

  function readAll(sql) {
    const res = sdb.exec(sql);
    if (res.length === 0) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const obj = {};
      cols.forEach((c, i) => obj[c] = row[i]);
      return obj;
    });
  }

  // Orden importa por claves foráneas
  const TABLAS = [
    'administradores',
    'empleados',
    'recibos',
    'firmas_empleados',
    'firmas_recibos',
    'descargas_recibos',
    'firma_admin'
  ];

  console.log('Vaciando tablas MySQL destino...');
  await pool.query('SET FOREIGN_KEY_CHECKS=0');
  for (const t of [...TABLAS].reverse()) {
    await pool.query(`DELETE FROM ${t}`);
    await pool.query(`ALTER TABLE ${t} AUTO_INCREMENT = 1`).catch(() => {});
  }
  await pool.query('SET FOREIGN_KEY_CHECKS=1');

  for (const tabla of TABLAS) {
    let filas;
    try {
      filas = readAll(`SELECT * FROM ${tabla}`);
    } catch (e) {
      console.log(`Tabla ${tabla} no existe en SQLite, salteando.`);
      continue;
    }
    if (filas.length === 0) {
      console.log(`${tabla}: 0 filas`);
      continue;
    }

    // Normalizar valores null/undefined y strings de fecha
    for (const fila of filas) {
      for (const k of Object.keys(fila)) {
        if (fila[k] === undefined) fila[k] = null;
      }
    }

    const columnas = Object.keys(filas[0]);
    const placeholders = columnas.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${placeholders})`;

    await pool.query('SET FOREIGN_KEY_CHECKS=0');
    let ok = 0;
    for (const fila of filas) {
      const valores = columnas.map(c => fila[c]);
      try {
        await pool.query(sql, valores);
        ok++;
      } catch (e) {
        console.error(`Error insertando fila en ${tabla}:`, e.message, fila);
      }
    }
    await pool.query('SET FOREIGN_KEY_CHECKS=1');
    console.log(`${tabla}: ${ok}/${filas.length} filas migradas`);
  }

  await pool.end();
  console.log('\nMigración completada.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error en migración:', err);
  process.exit(1);
});
