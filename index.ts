// app.js
import express from 'express'
import multer from 'multer'
import { Client } from 'pg'
import fs from 'fs'
import path from 'path';
import csv from 'csv-parser'
import verifyAndSetupTable from './src/realconnect';
const PORT = process.env.PORT || 3000;

const app = express();

// Configuración para servir archivos estáticos
app.use(express.static('public'));

// Configuración para subir archivos con multer
const upload = multer({ dest: 'uploads/' });

// Conexión a la base de datos PostgreSQL
const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'geo_db',
  password: '123456789',
  port: 5432,
});

client.connect().catch(error => {
  console.error('No se pudo conectar a la base de datos:', error.message);
  process.exit(1);
});

verifyAndSetupTable();


// Ruta para la página de inicio
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta para subir archivos GeoJSON
app.post('/upload', upload.single('geojson'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('Archivo GeoJSON no recibido.');
    }

    const geojsonPath = req.file.path;
    const extension = path.extname(geojsonPath).toLowerCase();

    if (extension !== '.geojson') {
      return res.status(400).send('Formato de archivo no válido. Asegúrate de subir un archivo GeoJSON.');
    }

    const fileName = path.basename(geojsonPath);
    if (fileName !== 'DEPARTAMENTOS.geojson') {
      fs.unlinkSync(geojsonPath);
      return res.status(400).send('El archivo subido debe ser DEPARTAMENTOS.geojson.');
    }

    const data = [];

    // Leer el archivo GeoJSON y validar los datos
    fs.createReadStream(geojsonPath)
      .pipe(csv())
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', async () => {
        if (data.length === 0) {
          fs.unlinkSync(geojsonPath);
          return res.status(400).send('El archivo GeoJSON está vacío o no contiene datos válidos.');
        }

        // Definir las columnas esperadas
        const expectedColumns = ['OBJECTID', 'CODDEP', 'DEPARTAMEN', 'CAPITAL', 'FUENTE', 'GEOMETRY'];

        for (let record of data) {
          const columns = Object.keys(record); // Obtiene las claves del objeto como nombres de columnas
          if (columns.length !== expectedColumns.length || !expectedColumns.every(col => columns.includes(col))) {
            fs.unlinkSync(geojsonPath);
            return res.status(400).send('Los datos en el archivo GeoJSON no coinciden con la estructura de la tabla.');
          }

          const values = [
            record.OBJECTID,
            record.CODDEP,
            record.DEPARTAMEN,
            record.CAPITAL,
            record.FUENTE,
            `ST_SetSRID(ST_GeomFromGeoJSON('${JSON.stringify(record.geometry)}'), 4326)` // Convertir la geometría GeoJSON a un formato soportado por PostgreSQL
          ];

          const query = `INSERT INTO DEPARTAMENTOS (OBJECTID, CODDEP, DEPARTAMEN, CAPITAL, FUENTE, GEOMETRY) VALUES ($1, $2, $3, $4, $5, $6)`;

          try {
            await client.query(query, values);
          } catch (err) {
            console.error('Error al insertar en la base de datos:', err.message);
            res.status(500).send('Error al insertar los datos en la base de datos.');
          }
        }

        fs.unlinkSync(geojsonPath);
        res.status(200).send('Archivo GeoJSON cargado y procesado exitosamente.');
      });
  } catch (error) {
    console.error('Error al procesar el archivo GeoJSON:', error.message);
    res.status(500).send('Error al procesar el archivo GeoJSON.');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
