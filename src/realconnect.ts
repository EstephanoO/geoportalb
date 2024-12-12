// mydb-lib/index.js
import { Client } from 'pg'

const client = new Client({
  user: 'postgres',
  host: 'localhost',
  database: 'geo_db',
  password: 'your_password',
  port: 5432,
});

client.connect().catch(error => {
  console.error('No se pudo conectar a la base de datos:', error.message);
  process.exit(1);
});

/**
 * Verifica si la tabla DEPARTAMENTOS existe y tiene la estructura correcta.
 * Si no existe, la crea. Si la estructura no coincide, la elimina y la recrea.
 */
const verifyAndSetupTable = async () => {
  try {
    // Verificar si la tabla ya existe
    const res = await client.query(
      "SELECT to_regclass('public.DEPARTAMENTOS') AS tableName;"
    );

    if (!res.rows[0].tableName) {
      // La tabla no existe, la creamos desde cero
      await client.query(`
        CREATE TABLE DEPARTAMENTOS (
            OBJECTID SERIAL PRIMARY KEY,
            CODDEP VARCHAR(10),
            DEPARTAMEN VARCHAR(50),
            CAPITAL VARCHAR(100),
            FUENTE VARCHAR(50),
            GEOMETRY GEOMETRY(MultiPolygon, 4326)
        );
      `);
      console.log('Tabla DEPARTAMENTOS creada exitosamente.');
    } else {
      // Verificar si la estructura es correcta
      const columnsRes = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'DEPARTAMENTOS';
      `);

      const expectedColumns = [
        { name: 'OBJECTID', type: 'integer' },
        { name: 'CODDEP', type: 'character varying' },
        { name: 'DEPARTAMEN', type: 'character varying' },
        { name: 'CAPITAL', type: 'character varying' },
        { name: 'FUENTE', type: 'character varying' },
        { name: 'GEOMETRY', type: 'geometry' },
      ];

      // Comprobar si todos los nombres y tipos de columnas coinciden con los esperados
      let structureCorrect = true;
      for (const expectedColumn of expectedColumns) {
        const column = columnsRes.rows.find(col => col.column_name === expectedColumn.name);
        if (!column || column.data_type !== expectedColumn.type) {
          structureCorrect = false;
          break;
        }
      }

      if (!structureCorrect) {
        // La estructura de la tabla es incorrecta, eliminar y recrear la tabla
        await client.query('DROP TABLE DEPARTAMENTOS;');
        await client.query(`
          CREATE TABLE DEPARTAMENTOS (
              OBJECTID SERIAL PRIMARY KEY,
              CODDEP VARCHAR(10),
              DEPARTAMEN VARCHAR(50),
              CAPITAL VARCHAR(100),
              FUENTE VARCHAR(50),
              GEOMETRY GEOMETRY(MultiPolygon, 4326)
          );
        `);
        console.log('Tabla DEPARTAMENTOS eliminada y recreada exitosamente.');
      }
    }
  } catch (error) {
    console.error('Error al verificar o configurar la tabla:', error.message);
  }
};

export default verifyAndSetupTable;
