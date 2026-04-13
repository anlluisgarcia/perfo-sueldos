require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDatabase, getDb } = require('./database');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'recibos_sueldos_secret_key_2024';

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.pdf';
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Auth
function authAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function authEmpleado(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.rol !== 'empleado') return res.status(403).json({ error: 'Acceso denegado' });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

// ==================== RUTAS DE AUTENTICACIÓN ====================

app.post('/api/admin/login', async (req, res) => {
  try {
    const { usuario, clave } = req.body;
    const db = getDb();
    const result = await db.exec('SELECT * FROM administradores WHERE usuario = ?', [usuario]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const admin = result[0].values[0];
    const columns = result[0].columns;
    const adminObj = {};
    columns.forEach((col, i) => adminObj[col] = admin[i]);

    if (!bcrypt.compareSync(clave, adminObj.clave)) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (adminObj.estado === 'inactivo') {
      return res.status(403).json({ error: 'Su cuenta está inactiva. Contacte al administrador.' });
    }
    const token = jwt.sign({ id: adminObj.id, usuario: adminObj.usuario, rol: 'admin', permiso: adminObj.permiso || 'administrativo' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, nombre: adminObj.nombre, permiso: adminObj.permiso || 'administrativo' });
  } catch (err) {
    console.error('Login admin error:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/api/empleado/login', async (req, res) => {
  try {
    const { dni, clave } = req.body;
    const db = getDb();
    const result = await db.exec('SELECT * FROM empleados WHERE dni = ?', [dni]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(401).json({ error: 'DNI o clave incorrectos' });
    }
    const emp = result[0].values[0];
    const columns = result[0].columns;
    const empObj = {};
    columns.forEach((col, i) => empObj[col] = emp[i]);

    if (empObj.estado === 'inactivo') {
      return res.status(403).json({ error: 'Su cuenta está inactiva. Contacte al administrador.' });
    }
    if (!bcrypt.compareSync(clave, empObj.clave)) {
      return res.status(401).json({ error: 'DNI o clave incorrectos' });
    }
    const token = jwt.sign({ id: empObj.id, dni: empObj.dni, rol: 'empleado' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, nombre: empObj.nombre });
  } catch (err) {
    console.error('Login empleado error:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// ==================== RUTAS ADMIN - EMPLEADOS ====================

app.get('/api/admin/empleados', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec('SELECT id, nombre, dni, telefono, direccion, empresa, estado, created_at FROM empleados ORDER BY nombre');
    if (result.length === 0) return res.json([]);
    const columns = result[0].columns;
    const empleados = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(empleados);
  } catch (err) {
    console.error('Listar empleados error:', err);
    res.status(500).json({ error: 'Error al listar empleados' });
  }
});

app.post('/api/admin/empleados', authAdmin, async (req, res) => {
  try {
    const { nombre, dni, clave, telefono, direccion, empresa } = req.body;
    if (!nombre || !dni || !clave) {
      return res.status(400).json({ error: 'Nombre, DNI y clave son obligatorios' });
    }
    const db = getDb();
    const existing = await db.exec('SELECT id FROM empleados WHERE dni = ?', [dni]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: 'Ya existe un empleado con ese DNI' });
    }
    const hash = bcrypt.hashSync(clave, 10);
    await db.run(
      'INSERT INTO empleados (nombre, dni, clave, telefono, direccion, empresa) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, dni, hash, telefono || '', direccion || '', empresa || '']
    );
    res.json({ message: 'Empleado creado exitosamente' });
  } catch (err) {
    console.error('Crear empleado error:', err);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

app.put('/api/admin/empleados/:id', authAdmin, async (req, res) => {
  try {
    const { nombre, dni, clave, telefono, direccion, empresa, estado } = req.body;
    const id = parseInt(req.params.id);
    const db = getDb();
    if (clave) {
      const hash = bcrypt.hashSync(clave, 10);
      await db.run(
        'UPDATE empleados SET nombre=?, dni=?, clave=?, telefono=?, direccion=?, empresa=?, estado=? WHERE id=?',
        [nombre, dni, hash, telefono || '', direccion || '', empresa || '', estado || 'activo', id]
      );
    } else {
      await db.run(
        'UPDATE empleados SET nombre=?, dni=?, telefono=?, direccion=?, empresa=?, estado=? WHERE id=?',
        [nombre, dni, telefono || '', direccion || '', empresa || '', estado || 'activo', id]
      );
    }
    res.json({ message: 'Empleado actualizado exitosamente' });
  } catch (err) {
    console.error('Error al actualizar empleado:', err);
    res.status(500).json({ error: 'Error al actualizar empleado' });
  }
});

app.delete('/api/admin/empleados/:id', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM firmas_recibos WHERE empleado_id = ?', [req.params.id]);
    await db.run('DELETE FROM firmas_empleados WHERE empleado_id = ?', [req.params.id]);
    await db.run('DELETE FROM recibos WHERE empleado_id = ?', [req.params.id]);
    await db.run('DELETE FROM empleados WHERE id = ?', [req.params.id]);
    res.json({ message: 'Empleado eliminado exitosamente' });
  } catch (err) {
    console.error('Eliminar empleado error:', err);
    res.status(500).json({ error: 'Error al eliminar empleado' });
  }
});

// ==================== RUTAS ADMIN - RECIBOS ====================

async function estamparFirmaAdmin(filePath, empresa) {
  const db = getDb();
  const firmaResult = await db.exec('SELECT firma_data FROM firma_admin WHERE id = 1');
  if (firmaResult.length === 0 || firmaResult[0].values.length === 0) return;

  const firmaData = firmaResult[0].values[0][0];
  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const firmaBase64 = firmaData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  const firmaBytes = Buffer.from(firmaBase64, 'base64');
  let firmaImage;
  if (firmaData.includes('image/png')) {
    firmaImage = await pdfDoc.embedPng(firmaBytes);
  } else {
    firmaImage = await pdfDoc.embedJpg(firmaBytes);
  }

  const firmaWidth = 150;
  const firmaHeight = (firmaImage.height / firmaImage.width) * firmaWidth;

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();
  console.log('Empresa recibida para estampar firma:', JSON.stringify(empresa));
  let firmaX = width - firmaWidth - 239;
  let firmaY = 200;
  if (empresa && empresa.toUpperCase().includes('PERFORACIONES IGLESIANAS')) {
    firmaX = firmaX + 227;
    firmaY = firmaY - 170;
  }
  lastPage.drawImage(firmaImage, {
    x: firmaX,
    y: firmaY,
    width: firmaWidth,
    height: firmaHeight,
  });

  const modifiedPdf = await pdfDoc.save();
  fs.writeFileSync(filePath, Buffer.from(modifiedPdf));
}

app.post('/api/admin/recibos', authAdmin, upload.array('pdfs', 50), async (req, res) => {
  try {
    const { empleado_id, fecha_recibo, descripcion } = req.body;
    if (!empleado_id || !fecha_recibo) {
      return res.status(400).json({ error: 'Empleado y fecha de recibo son obligatorios' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Debe subir al menos un archivo PDF' });
    }
    const db = getDb();

    const existeRecibo = await db.exec(
      'SELECT id FROM recibos WHERE empleado_id = ? AND fecha_recibo = ?',
      [empleado_id, fecha_recibo]
    );
    if (existeRecibo.length > 0 && existeRecibo[0].values.length > 0) {
      for (const file of req.files) {
        try { fs.unlinkSync(path.join(__dirname, 'uploads', file.filename)); } catch(e) {}
      }
      return res.status(400).json({ error: 'RECIBO DE SUELDO CARGADO CON ANTERIORIDAD' });
    }

    const empResult = await db.exec('SELECT empresa FROM empleados WHERE id = ?', [empleado_id]);
    const empresa = (empResult.length > 0 && empResult[0].values.length > 0) ? empResult[0].values[0][0] : '';

    for (const file of req.files) {
      try {
        await estamparFirmaAdmin(path.join(__dirname, 'uploads', file.filename), empresa);
      } catch (err) {
        console.error('Error al estampar firma en', file.originalname, err);
      }
      await db.run(
        'INSERT INTO recibos (empleado_id, fecha_recibo, archivo_nombre, archivo_path, descripcion) VALUES (?, ?, ?, ?, ?)',
        [empleado_id, fecha_recibo, file.originalname, file.filename, descripcion || '']
      );
    }
    res.json({ message: `${req.files.length} recibo(s) subido(s) exitosamente` });
  } catch (err) {
    console.error('Subir recibos error:', err);
    res.status(500).json({ error: 'Error al subir recibos' });
  }
});

app.post('/api/admin/recibos/masivo', authAdmin, upload.array('pdfs', 100), async (req, res) => {
  try {
    const { fecha_recibo, descripcion } = req.body;
    if (!fecha_recibo) {
      return res.status(400).json({ error: 'La fecha de recibo es obligatoria' });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Debe subir al menos un archivo PDF' });
    }
    const db = getDb();
    let asignados = 0;
    const noEncontrados = [];
    const duplicados = [];

    for (const file of req.files) {
      const dniMatch = file.originalname.match(/(\d{7,8})/);
      if (dniMatch) {
        const dni = dniMatch[1];
        const result = await db.exec('SELECT id, empresa FROM empleados WHERE dni = ?', [dni]);
        if (result.length > 0 && result[0].values.length > 0) {
          const empleadoId = result[0].values[0][0];
          const empresaMasivo = result[0].values[0][1] || '';

          const existeRecibo = await db.exec(
            'SELECT id FROM recibos WHERE empleado_id = ? AND fecha_recibo = ?',
            [empleadoId, fecha_recibo]
          );
          if (existeRecibo.length > 0 && existeRecibo[0].values.length > 0) {
            duplicados.push(file.originalname);
            try { fs.unlinkSync(path.join(__dirname, 'uploads', file.filename)); } catch(e) {}
            continue;
          }

          try {
            await estamparFirmaAdmin(path.join(__dirname, 'uploads', file.filename), empresaMasivo);
          } catch (err) {
            console.error('Error al estampar firma en', file.originalname, err);
          }
          await db.run(
            'INSERT INTO recibos (empleado_id, fecha_recibo, archivo_nombre, archivo_path, descripcion) VALUES (?, ?, ?, ?, ?)',
            [empleadoId, fecha_recibo, file.originalname, file.filename, descripcion || '']
          );
          asignados++;
        } else {
          noEncontrados.push(file.originalname);
        }
      } else {
        noEncontrados.push(file.originalname);
      }
    }
    let message = `${asignados} recibo(s) asignado(s) exitosamente`;
    if (duplicados.length > 0) {
      message += `. ${duplicados.length} archivo(s) no cargado(s): RECIBO DE SUELDO CARGADO CON ANTERIORIDAD`;
    }
    res.json({ message, no_encontrados: noEncontrados, duplicados });
  } catch (err) {
    console.error('Subir masivo error:', err);
    res.status(500).json({ error: 'Error al subir recibos masivos' });
  }
});

app.get('/api/admin/recibos/:empleadoId', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec(
      'SELECT r.*, e.nombre as empleado_nombre, e.dni FROM recibos r JOIN empleados e ON r.empleado_id = e.id WHERE r.empleado_id = ? ORDER BY r.fecha_recibo DESC',
      [req.params.empleadoId]
    );
    if (result.length === 0) return res.json([]);
    const columns = result[0].columns;
    const recibos = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(recibos);
  } catch (err) {
    console.error('Listar recibos empleado error:', err);
    res.status(500).json({ error: 'Error al listar recibos' });
  }
});

app.get('/api/admin/recibos', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec(
      `SELECT r.id, r.empleado_id, r.fecha_recibo, r.archivo_nombre, r.archivo_path, r.descripcion, r.created_at,
              e.nombre as empleado_nombre, e.dni, e.empresa,
              CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as firmado,
              f.fecha_firma,
              d.fecha_descarga
       FROM recibos r
       JOIN empleados e ON r.empleado_id = e.id
       LEFT JOIN firmas_recibos f ON r.id = f.recibo_id
       LEFT JOIN (
         SELECT recibo_id, MIN(fecha_descarga) as fecha_descarga
         FROM descargas_recibos
         GROUP BY recibo_id
       ) d ON r.id = d.recibo_id
       ORDER BY r.fecha_recibo DESC`
    );
    if (result.length === 0) return res.json([]);
    const columns = result[0].columns;
    const recibos = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(recibos);
  } catch (err) {
    console.error('Listar todos recibos error:', err);
    res.status(500).json({ error: 'Error al listar recibos' });
  }
});

app.delete('/api/admin/recibos/:id', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec('SELECT archivo_path FROM recibos WHERE id = ?', [req.params.id]);
    if (result.length > 0 && result[0].values.length > 0) {
      const filePath = path.join(__dirname, 'uploads', result[0].values[0][0]);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.run('DELETE FROM firmas_recibos WHERE recibo_id = ?', [req.params.id]);
    await db.run('DELETE FROM descargas_recibos WHERE recibo_id = ?', [req.params.id]);
    await db.run('DELETE FROM recibos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Recibo eliminado exitosamente' });
  } catch (err) {
    console.error('Eliminar recibo error:', err);
    res.status(500).json({ error: 'Error al eliminar recibo' });
  }
});

// ==================== RUTAS EMPLEADO ====================

app.get('/api/empleado/recibos', authEmpleado, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec(
      `SELECT r.id, r.fecha_recibo, r.archivo_nombre, r.descripcion, r.created_at,
              CASE WHEN f.id IS NOT NULL THEN 1 ELSE 0 END as firmado,
              f.fecha_firma
       FROM recibos r
       LEFT JOIN firmas_recibos f ON r.id = f.recibo_id AND f.empleado_id = ?
       WHERE r.empleado_id = ?
       ORDER BY r.fecha_recibo DESC`,
      [req.user.id, req.user.id]
    );
    if (result.length === 0) return res.json([]);
    const columns = result[0].columns;
    const recibos = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(recibos);
  } catch (err) {
    console.error('Recibos empleado error:', err);
    res.status(500).json({ error: 'Error al listar recibos' });
  }
});

app.get('/api/recibo/descargar/:id', async (req, res) => {
  const tkn = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!tkn) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(tkn, JWT_SECRET);
    const db = getDb();
    const result = await db.exec('SELECT * FROM recibos WHERE id = ?', [req.params.id]);
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }
    const columns = result[0].columns;
    const recibo = {};
    columns.forEach((col, i) => recibo[col] = result[0].values[0][i]);

    if (decoded.rol === 'empleado' && recibo.empleado_id !== decoded.id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    const filePath = path.join(__dirname, 'uploads', recibo.archivo_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    if (decoded.rol === 'empleado') {
      await db.run(
        'INSERT INTO descargas_recibos (recibo_id, empleado_id) VALUES (?, ?)',
        [req.params.id, decoded.id]
      );
    }

    if (decoded.rol === 'empleado') {
      let firmaData = null;
      const firmaReciboResult = await db.exec(
        'SELECT firma_data FROM firmas_recibos WHERE recibo_id = ? AND empleado_id = ?',
        [req.params.id, decoded.id]
      );
      if (firmaReciboResult.length > 0 && firmaReciboResult[0].values.length > 0) {
        firmaData = firmaReciboResult[0].values[0][0];
      } else {
        const firmaPersonalResult = await db.exec(
          'SELECT firma_data FROM firmas_empleados WHERE empleado_id = ?',
          [decoded.id]
        );
        if (firmaPersonalResult.length > 0 && firmaPersonalResult[0].values.length > 0) {
          firmaData = firmaPersonalResult[0].values[0][0];
          await db.run(
            'INSERT IGNORE INTO firmas_recibos (recibo_id, empleado_id, firma_data) VALUES (?, ?, ?)',
            [req.params.id, decoded.id, firmaData]
          );
        }
      }

      if (firmaData) {
        try {
          const pdfBytes = fs.readFileSync(filePath);
          const pdfDoc = await PDFDocument.load(pdfBytes);

          const firmaBase64 = firmaData.replace(/^data:image\/png;base64,/, '');
          const firmaBytes = Buffer.from(firmaBase64, 'base64');
          const firmaImage = await pdfDoc.embedPng(firmaBytes);

          const firmaWidth = 150;
          const firmaHeight = (firmaImage.height / firmaImage.width) * firmaWidth;

          const empEmpresaResult = await db.exec('SELECT empresa FROM empleados WHERE id = ?', [decoded.id]);
          const empEmpresa = (empEmpresaResult.length > 0 && empEmpresaResult[0].values.length > 0) ? empEmpresaResult[0].values[0][0] : '';

          let firmaEmpleadoX = 25;
          let firmaEmpleadoY = 171;
          if (empEmpresa && empEmpresa.toUpperCase().includes('PERFORACIONES IGLESIANAS')) {
            firmaEmpleadoX = 25 + 227;
            firmaEmpleadoY = 171 - 142;
          }

          const pages = pdfDoc.getPages();
          const lastPage = pages[pages.length - 1];
          lastPage.drawImage(firmaImage, {
            x: firmaEmpleadoX,
            y: firmaEmpleadoY,
            width: firmaWidth,
            height: firmaHeight,
          });

          const modifiedPdf = await pdfDoc.save();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${recibo.archivo_nombre}"`);
          return res.send(Buffer.from(modifiedPdf));
        } catch (pdfErr) {
          console.error('Error al estampar firma en PDF:', pdfErr);
        }
      }
    }

    res.download(filePath, recibo.archivo_nombre);
  } catch (err) {
    console.error('Descargar recibo error:', err);
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.get('/api/empleado/mi-firma', authEmpleado, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec(
      'SELECT firma_data, updated_at FROM firmas_empleados WHERE empleado_id = ?',
      [req.user.id]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return res.json({ tiene_firma: false });
    }
    res.json({
      tiene_firma: true,
      firma_data: result[0].values[0][0],
      updated_at: result[0].values[0][1]
    });
  } catch (err) {
    console.error('Mi firma GET error:', err);
    res.status(500).json({ error: 'Error al obtener firma' });
  }
});

app.post('/api/empleado/mi-firma', authEmpleado, async (req, res) => {
  try {
    const { firma_data } = req.body;
    if (!firma_data) {
      return res.status(400).json({ error: 'La firma es obligatoria' });
    }
    const db = getDb();
    const existing = await db.exec('SELECT id FROM firmas_empleados WHERE empleado_id = ?', [req.user.id]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      await db.run(
        'UPDATE firmas_empleados SET firma_data = ? WHERE empleado_id = ?',
        [firma_data, req.user.id]
      );
    } else {
      await db.run(
        'INSERT INTO firmas_empleados (empleado_id, firma_data) VALUES (?, ?)',
        [req.user.id, firma_data]
      );
    }
    res.json({ message: 'Firma guardada exitosamente' });
  } catch (err) {
    console.error('Mi firma POST error:', err);
    res.status(500).json({ error: 'Error al guardar firma' });
  }
});

app.post('/api/empleado/recibo/:id/firmar', authEmpleado, async (req, res) => {
  try {
    const db = getDb();
    const firma = await db.exec('SELECT firma_data FROM firmas_empleados WHERE empleado_id = ?', [req.user.id]);
    if (firma.length === 0 || firma[0].values.length === 0) {
      return res.status(400).json({ error: 'Debe crear su firma personal antes de firmar recibos' });
    }

    const recibo = await db.exec('SELECT id FROM recibos WHERE id = ? AND empleado_id = ?', [req.params.id, req.user.id]);
    if (recibo.length === 0 || recibo[0].values.length === 0) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }

    const yaFirmado = await db.exec(
      'SELECT id FROM firmas_recibos WHERE recibo_id = ? AND empleado_id = ?',
      [req.params.id, req.user.id]
    );
    if (yaFirmado.length > 0 && yaFirmado[0].values.length > 0) {
      return res.status(400).json({ error: 'Este recibo ya fue firmado' });
    }

    const firmaData = firma[0].values[0][0];
    await db.run(
      'INSERT INTO firmas_recibos (recibo_id, empleado_id, firma_data) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, firmaData]
    );
    res.json({ message: 'Recibo firmado exitosamente' });
  } catch (err) {
    console.error('Firmar recibo error:', err);
    res.status(500).json({ error: 'Error al firmar recibo' });
  }
});

app.get('/api/empleado/perfil', authEmpleado, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec('SELECT id, nombre, dni, telefono, direccion, estado FROM empleados WHERE id = ?', [req.user.id]);
    if (result.length === 0) return res.status(404).json({ error: 'Empleado no encontrado' });
    const columns = result[0].columns;
    const emp = {};
    columns.forEach((col, i) => emp[col] = result[0].values[0][i]);
    res.json(emp);
  } catch (err) {
    console.error('Perfil error:', err);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// ==================== RECIBO FIRMADO (PDF con firma) ====================
app.get('/api/admin/recibo-firmado/:id', async (req, res) => {
  const tkn = req.query.token || req.headers.authorization?.split(' ')[1];
  if (!tkn) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(tkn, JWT_SECRET);
    if (decoded.rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  } catch {
    return res.status(401).json({ error: 'Token inválido' });
  }
  try {
    const db = getDb();
    const result = await db.exec(
      `SELECT r.archivo_path, r.archivo_nombre, f.firma_data, e.nombre as empleado_nombre
       FROM recibos r
       JOIN empleados e ON r.empleado_id = e.id
       LEFT JOIN firmas_recibos f ON r.id = f.recibo_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }
    const cols = result[0].columns;
    const row = {};
    cols.forEach((c, i) => row[c] = result[0].values[0][i]);

    if (!row.firma_data) {
      return res.status(400).json({ error: 'Este recibo no ha sido firmado por el empleado' });
    }

    const filePath = path.join(__dirname, 'uploads', row.archivo_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo PDF no encontrado' });
    }

    const pdfBytes = fs.readFileSync(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const firmaBase64 = row.firma_data.replace(/^data:image\/png;base64,/, '');
    const firmaBytes = Buffer.from(firmaBase64, 'base64');
    const firmaImage = await pdfDoc.embedPng(firmaBytes);

    const pages = pdfDoc.getPages();
    const firmaWidth = 150;
    const firmaHeight = (firmaImage.height / firmaImage.width) * firmaWidth;

    const empInfoResult = await db.exec(
      'SELECT e.empresa FROM recibos r JOIN empleados e ON r.empleado_id = e.id WHERE r.id = ?',
      [req.params.id]
    );
    const empEmpresaAdmin = (empInfoResult.length > 0 && empInfoResult[0].values.length > 0) ? empInfoResult[0].values[0][0] : '';

    let firmaEmpX = 25;
    let firmaEmpY = 171;
    if (empEmpresaAdmin && empEmpresaAdmin.toUpperCase().includes('PERFORACIONES IGLESIANAS')) {
      firmaEmpX = 25 + 227;
      firmaEmpY = 171 - 142;
    }

    for (const page of pages) {
      page.drawImage(firmaImage, {
        x: firmaEmpX,
        y: firmaEmpY,
        width: firmaWidth,
        height: firmaHeight,
      });
    }

    const modifiedPdf = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="firmado_${row.archivo_nombre}"`);
    res.send(Buffer.from(modifiedPdf));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar el PDF firmado' });
  }
});

// ==================== ADMIN - FIRMA ADMINISTRATIVA ====================

app.get('/api/admin/firma', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec('SELECT firma_data, updated_at FROM firma_admin WHERE id = 1');
    if (result.length === 0 || result[0].values.length === 0) {
      return res.json({ tiene_firma: false });
    }
    res.json({
      tiene_firma: true,
      firma_data: result[0].values[0][0],
      updated_at: result[0].values[0][1]
    });
  } catch (err) {
    console.error('Firma admin GET error:', err);
    res.status(500).json({ error: 'Error al obtener firma' });
  }
});

app.post('/api/admin/firma', authAdmin, async (req, res) => {
  try {
    const { firma_data } = req.body;
    if (!firma_data) {
      return res.status(400).json({ error: 'La firma es obligatoria' });
    }
    const db = getDb();
    const existing = await db.exec('SELECT id FROM firma_admin WHERE id = 1');
    if (existing.length > 0 && existing[0].values.length > 0) {
      await db.run('UPDATE firma_admin SET firma_data = ? WHERE id = 1', [firma_data]);
    } else {
      await db.run('INSERT INTO firma_admin (id, firma_data) VALUES (1, ?)', [firma_data]);
    }
    res.json({ message: 'Firma guardada exitosamente' });
  } catch (err) {
    console.error('Firma admin POST error:', err);
    res.status(500).json({ error: 'Error al guardar firma' });
  }
});

app.delete('/api/admin/firma', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM firma_admin WHERE id = 1');
    res.json({ message: 'Firma eliminada exitosamente' });
  } catch (err) {
    console.error('Firma admin DELETE error:', err);
    res.status(500).json({ error: 'Error al eliminar firma' });
  }
});

// ==================== RUTAS ADMIN - USUARIOS ADMIN ====================

function noOperador(req, res, next) {
  if (req.user.permiso === 'operador') {
    return res.status(403).json({ error: 'Acceso denegado. Los operadores no tienen acceso a este módulo.' });
  }
  next();
}

app.get('/api/admin/usuarios', authAdmin, noOperador, async (req, res) => {
  try {
    const db = getDb();
    const result = await db.exec('SELECT id, usuario, nombre, estado, permiso, created_at FROM administradores ORDER BY nombre');
    if (result.length === 0) return res.json([]);
    const columns = result[0].columns;
    const usuarios = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => obj[col] = row[i]);
      return obj;
    });
    res.json(usuarios);
  } catch (err) {
    console.error('Listar usuarios error:', err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

app.post('/api/admin/usuarios', authAdmin, noOperador, async (req, res) => {
  try {
    const { usuario, clave, nombre, estado, permiso } = req.body;
    if (!usuario || !clave || !nombre) {
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios' });
    }
    const permisosValidos = ['administrativo', 'supervisor', 'operador'];
    if (permiso && !permisosValidos.includes(permiso)) {
      return res.status(400).json({ error: 'Permiso inválido. Valores permitidos: administrativo, supervisor, operador' });
    }
    const db = getDb();
    const existing = await db.exec('SELECT id FROM administradores WHERE usuario = ?', [usuario]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese nombre de usuario' });
    }
    const hash = bcrypt.hashSync(clave, 10);
    await db.run(
      'INSERT INTO administradores (usuario, clave, nombre, estado, permiso) VALUES (?, ?, ?, ?, ?)',
      [usuario, hash, nombre, estado || 'activo', permiso || 'administrativo']
    );
    res.json({ message: 'Usuario creado exitosamente' });
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.put('/api/admin/usuarios/:id', authAdmin, noOperador, async (req, res) => {
  try {
    const { usuario, clave, nombre, estado, permiso } = req.body;
    const id = parseInt(req.params.id);
    const permisosValidos = ['administrativo', 'supervisor', 'operador'];
    if (permiso && !permisosValidos.includes(permiso)) {
      return res.status(400).json({ error: 'Permiso inválido. Valores permitidos: administrativo, supervisor, operador' });
    }
    const db = getDb();
    const existing = await db.exec('SELECT id FROM administradores WHERE usuario = ? AND id != ?', [usuario, id]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      return res.status(400).json({ error: 'Ya existe otro usuario con ese nombre de usuario' });
    }
    if (clave) {
      const hash = bcrypt.hashSync(clave, 10);
      await db.run(
        'UPDATE administradores SET usuario=?, clave=?, nombre=?, estado=?, permiso=? WHERE id=?',
        [usuario, hash, nombre, estado || 'activo', permiso || 'administrativo', id]
      );
    } else {
      await db.run(
        'UPDATE administradores SET usuario=?, nombre=?, estado=?, permiso=? WHERE id=?',
        [usuario, nombre, estado || 'activo', permiso || 'administrativo', id]
      );
    }
    res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

app.delete('/api/admin/usuarios/:id', authAdmin, noOperador, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const db = getDb();
    if (req.user.id === id) {
      return res.status(400).json({ error: 'No puede eliminar su propio usuario' });
    }
    if (req.user.permiso === 'administrativo') {
      const targetResult = await db.exec('SELECT permiso FROM administradores WHERE id = ?', [id]);
      if (targetResult.length > 0 && targetResult[0].values.length > 0) {
        const targetPermiso = targetResult[0].values[0][0];
        if (targetPermiso === 'supervisor') {
          return res.status(403).json({ error: 'No tiene permisos para eliminar usuarios con permiso Supervisor.' });
        }
      }
    }
    await db.run('DELETE FROM administradores WHERE id = ?', [id]);
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (err) {
    console.error('Eliminar usuario error:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// ==================== ESTADÍSTICAS ====================
app.get('/api/admin/estadisticas', authAdmin, async (req, res) => {
  try {
    const db = getDb();
    const r1 = await db.exec('SELECT COUNT(*) AS c FROM empleados');
    const r2 = await db.exec("SELECT COUNT(*) AS c FROM empleados WHERE estado = 'activo'");
    const r3 = await db.exec('SELECT COUNT(*) AS c FROM recibos');
    const totalEmpleados = r1[0].values[0][0];
    const activos = r2[0].values[0][0];
    const totalRecibos = r3[0].values[0][0];
    res.json({ totalEmpleados, activos, inactivos: totalEmpleados - activos, totalRecibos });
  } catch (err) {
    console.error('Estadísticas error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ==================== INICIAR SERVIDOR ====================
async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  Servidor de Recibos de Sueldos`);
    console.log(`  Puerto: ${PORT}`);
    console.log(`========================================\n`);
  });
}

start().catch(err => {
  console.error('Error al iniciar el servidor:', err);
  process.exit(1);
});
