/**
 * Almacén en MySQL (8.0 o superior). Las tablas están en db/esquema.sql.
 *
 * Reglas, las mismas que tenía la base anterior:
 * - Quien está en la lista (`cedulas`) solo entra con su fecha de nacimiento;
 *   la clave de la encuesta es para quien no está.
 * - Tras 5 fechas equivocadas distintas en 15 minutos, el documento queda
 *   bloqueado ese rato. Repetir la misma fecha no gasta intentos. El límite
 *   cuenta igual al validar y al enviar, para que ninguno de los dos caminos
 *   sirva para adivinar fechas.
 * - Una sola respuesta por número de documento, con cualquier tipo.
 *
 * Las comprobaciones de un mismo documento van de a una: la transacción
 * bloquea su fila de `cedulas` (SELECT ... FOR UPDATE). Sin eso, muchas
 * peticiones en paralelo pasarían antes de que se registre la quinta fecha.
 */

import { readFileSync } from 'node:fs'

import mysql from 'mysql2/promise'
import type { Pool, PoolConnection, RowDataPacket, SslOptions } from 'mysql2/promise'

import type { Almacen, Fila, ResultadoEnvio, ResultadoEstudiante } from './almacen'
import { NOMBRE_CLAVE, claveCoincide } from './clave'
import type { ConfiguracionMysql } from './configuracion'

const LIMITE_FECHAS = 5
const VENTANA = 'INTERVAL 15 MINUTE'

type Comprobacion = Exclude<ResultadoEstudiante, 'no_encontrado'>

/**
 * La conexión cifrada. Con el certificado de la autoridad (MYSQL_SSL_CA) se
 * verifica que el servidor es el verdadero. mysql2 revisa la cadena del
 * certificado y no el nombre, que es lo que sirve con Google Cloud SQL: su
 * certificado no se emite para la IP con que se conecta, y la autoridad es
 * exclusiva de la instancia.
 */
function opcionesSsl(configuracion: ConfiguracionMysql): SslOptions | undefined {
  if (!configuracion.ssl) return undefined
  if (!configuracion.certificadoCa) return { rejectUnauthorized: true }
  return { ca: readFileSync(configuracion.certificadoCa, 'utf8'), rejectUnauthorized: true }
}

export function crearPoolMysql(configuracion: ConfiguracionMysql): Pool {
  return mysql.createPool({
    host: configuracion.host,
    port: configuracion.port,
    user: configuracion.user,
    password: configuracion.password,
    database: configuracion.database,
    ssl: opcionesSsl(configuracion),
    connectionLimit: configuracion.conexiones,
    waitForConnections: true,
    connectTimeout: 8000,
    enableKeepAlive: true,
    charset: 'utf8mb4',
    // Fechas y horas en UTC, y las columnas DATE como texto AAAA-MM-DD, igual que en el formulario.
    timezone: 'Z',
    dateStrings: true,
  })
}

/** Una transacción en una conexión del pool. Si algo falla, se deshace. */
async function enTransaccion<T>(pool: Pool, trabajo: (conexion: PoolConnection) => Promise<T>): Promise<T> {
  const conexion = await pool.getConnection()
  try {
    // READ COMMITTED: bloquea solo las filas que toca, no rangos del índice.
    await conexion.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await conexion.beginTransaction()
    const resultado = await trabajo(conexion)
    await conexion.commit()
    return resultado
  } catch (error) {
    await conexion.rollback().catch(() => {})
    throw error
  } finally {
    conexion.release()
  }
}

/**
 * Para un documento de la lista, compara la fecha y lleva la cuenta de las
 * equivocadas. Devuelve null si el documento no está en la lista.
 */
async function comprobarFecha(conexion: PoolConnection, cedula: string, fecha: string): Promise<Comprobacion | null> {
  const [lista] = await conexion.query<RowDataPacket[]>(
    'SELECT fecha_nacimiento FROM cedulas WHERE cedula = ? FOR UPDATE',
    [cedula],
  )
  if (lista.length === 0) return null

  const [[{ fechas }]] = await conexion.query<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT fecha) AS fechas FROM intentos_validacion
     WHERE cedula = ? AND intentado_en > UTC_TIMESTAMP(3) - ${VENTANA}`,
    [cedula],
  )
  if (Number(fechas) >= LIMITE_FECHAS) return 'bloqueado'

  if (lista[0].fecha_nacimiento === fecha) return 'valido'

  const [repetida] = await conexion.query<RowDataPacket[]>(
    `SELECT 1 FROM intentos_validacion
     WHERE cedula = ? AND fecha = ? AND intentado_en > UTC_TIMESTAMP(3) - ${VENTANA} LIMIT 1`,
    [cedula, fecha],
  )
  if (repetida.length === 0) {
    // Los intentos viejos de este documento ya no cuentan: se limpian de paso.
    await conexion.query(
      'DELETE FROM intentos_validacion WHERE cedula = ? AND intentado_en < UTC_TIMESTAMP(3) - INTERVAL 1 DAY',
      [cedula],
    )
    await conexion.query(
      'INSERT INTO intentos_validacion (cedula, fecha, intentado_en) VALUES (?, ?, UTC_TIMESTAMP(3))',
      [cedula, fecha],
    )
  }
  return 'fecha_incorrecta'
}

async function claveValida(conexion: Pool | PoolConnection, claveEncuesta: string | null | undefined) {
  if (!claveEncuesta) return false
  const [filas] = await conexion.query<RowDataPacket[]>('SELECT clave_hash FROM claves WHERE nombre = ?', [
    NOMBRE_CLAVE,
  ])
  return filas.length > 0 && claveCoincide(claveEncuesta, String(filas[0].clave_hash))
}

/** MySQL no acepta la Z de ISO 8601: se pasa como fecha de JavaScript y el pool la escribe en UTC. */
const fechaHora = (iso: string | null) => (iso ? new Date(iso) : null)

export function crearAlmacenMysql(configuracion: ConfiguracionMysql, pool: Pool = crearPoolMysql(configuracion)): Almacen {
  return {
    async insertar(fila: Fila, { claveEncuesta = null } = {}): Promise<ResultadoEnvio> {
      return enTransaccion(pool, async (conexion) => {
        const comprobacion = fila.numero_documento
          ? await comprobarFecha(conexion, fila.numero_documento, fila.fecha_nacimiento)
          : null
        const validado = comprobacion !== null ? comprobacion === 'valido' : await claveValida(conexion, claveEncuesta)
        // Se confirma igual: la fecha equivocada queda contada.
        if (!validado) return 'no_validado'

        try {
          await conexion.query(
            `INSERT INTO respuestas (id, instrumento, version_instrumento, ruta, tipo_documento, numero_documento,
               fecha_nacimiento, respuestas, consentimiento_en, iniciada_en, enviada_en, duracion_segundos)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              fila.id,
              fila.instrumento,
              fila.version_instrumento,
              fila.ruta,
              fila.tipo_documento,
              fila.numero_documento,
              fila.fecha_nacimiento,
              JSON.stringify(fila.respuestas),
              fechaHora(fila.consentimiento_en),
              fechaHora(fila.iniciada_en),
              fechaHora(fila.enviada_en),
              fila.duracion_segundos,
            ],
          )
        } catch (error) {
          if ((error as { code?: string }).code !== 'ER_DUP_ENTRY') throw error
          // Choca con el id (el mismo envío que reintenta) o con el número (otra persona, o la misma otra vez).
          const [existe] = await conexion.query<RowDataPacket[]>('SELECT 1 FROM respuestas WHERE id = ?', [fila.id])
          return existe.length > 0 ? 'reintento' : 'documento_repetido'
        }
        return 'creada'
      })
    },

    async validarEstudiante(cedula: string, fecha: string): Promise<ResultadoEstudiante> {
      return enTransaccion(pool, async (conexion) => (await comprobarFecha(conexion, cedula, fecha)) ?? 'no_encontrado')
    },

    async validarClave(claveEncuesta: string): Promise<boolean> {
      return claveValida(pool, claveEncuesta)
    },

    async salud(): Promise<void> {
      await pool.query('SELECT 1')
    },
  }
}
