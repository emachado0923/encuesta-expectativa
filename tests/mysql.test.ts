/**
 * Pruebas contra un MySQL de verdad: el esquema, las reglas del almacén y los
 * permisos mínimos del usuario de la aplicación.
 *
 * Solo corren si MYSQL_PRUEBAS apunta a un servidor donde se puedan crear
 * bases y usuarios (por ejemplo, un MySQL local de desarrollo):
 *
 *   MYSQL_PRUEBAS=mysql://root@127.0.0.1:3306 npm test
 *
 * Crean una base y un usuario temporales y los borran al terminar.
 */

import { readFileSync } from 'node:fs'

import mysql from 'mysql2/promise'
import type { Connection, RowDataPacket } from 'mysql2/promise'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { crearAlmacenMysql, crearPoolMysql } from '@/servidor/almacen-mysql'
import type { Almacen, Fila } from '@/servidor/almacen'
import { NOMBRE_CLAVE, cifrarClave } from '@/servidor/clave'
import type { ConfiguracionMysql } from '@/servidor/configuracion'

const URL_ADMIN = process.env.MYSQL_PRUEBAS
/** Opcional: el certificado de la autoridad del servidor, para probar la conexión cifrada. */
const CA = process.env.MYSQL_PRUEBAS_CA ?? null
const BASE = `encuesta_pruebas_${process.pid}`
const USUARIO = `encuesta_prueba_${process.pid}`
const CONTRASENA = 'Prueba-temporal-123'
const CLAVE = 'la-clave-de-prueba'

describe.skipIf(!URL_ADMIN)('almacén de MySQL', () => {
  let admin: Connection
  let almacen: Almacen
  let pool: ReturnType<typeof crearPoolMysql>

  beforeAll(async () => {
    const url = new URL(URL_ADMIN as string)
    admin = await mysql.createConnection({
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      multipleStatements: true,
      dateStrings: true,
      timezone: 'Z',
    })
    await admin.query(`CREATE DATABASE ${BASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await admin.query(`USE ${BASE}`)
    await admin.query(readFileSync(new URL('../db/esquema.sql', import.meta.url), 'utf8'))

    // El usuario de la aplicación, con los permisos que indica db/esquema.sql y nada más.
    await admin.query(`CREATE USER '${USUARIO}'@'%' IDENTIFIED BY '${CONTRASENA}'`)
    await admin.query(`GRANT SELECT, INSERT ON ${BASE}.respuestas TO '${USUARIO}'@'%'`)
    await admin.query(`GRANT SELECT ON ${BASE}.cedulas TO '${USUARIO}'@'%'`)
    await admin.query(`GRANT SELECT ON ${BASE}.claves TO '${USUARIO}'@'%'`)
    await admin.query(`GRANT SELECT, INSERT, DELETE ON ${BASE}.intentos_validacion TO '${USUARIO}'@'%'`)
    await admin.query(`GRANT LOCK TABLES ON ${BASE}.* TO '${USUARIO}'@'%'`)

    await admin.query('INSERT INTO cedulas (cedula, fecha_nacimiento) VALUES ?', [
      [
        ['1037654321', '2008-05-14'],
        ['2222222222', '2008-05-14'],
        ['3333333333', '2008-05-14'],
        ['4444444444', '2008-05-14'],
        ['5555555555', '2008-05-14'],
      ],
    ])
    await admin.query('INSERT INTO claves (nombre, clave_hash) VALUES (?, ?)', [NOMBRE_CLAVE, await cifrarClave(CLAVE)])

    const configuracion: ConfiguracionMysql = {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: USUARIO,
      password: CONTRASENA,
      database: BASE,
      ssl: Boolean(CA),
      certificadoCa: CA,
      conexiones: 10,
    }
    pool = crearPoolMysql(configuracion)
    almacen = crearAlmacenMysql(configuracion, pool)
  })

  afterAll(async () => {
    await pool?.end()
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${BASE}`)
      await admin.query(`DROP USER IF EXISTS '${USUARIO}'@'%'`)
      await admin.end()
    }
  })

  const intentos = async (cedula: string) => {
    const [[fila]] = await admin.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM intentos_validacion WHERE cedula = ?',
      [cedula],
    )
    return Number(fila.n)
  }

  const fila = (extra: Partial<Fila> = {}): Fila => ({
    id: crypto.randomUUID(),
    instrumento: 'expectativas_grado11',
    version_instrumento: '2026.2',
    ruta: 'estudiar',
    tipo_documento: 'tarjeta_identidad',
    numero_documento: '1037654321',
    fecha_nacimiento: '2008-05-14',
    respuestas: { decision_bachillerato: 'estudiar', mundos_interes: ['digital', 'ciencia'] },
    consentimiento_en: '2026-09-18T15:00:00.000Z',
    iniciada_en: '2026-09-18T15:00:00.000Z',
    enviada_en: '2026-09-18T15:08:30.250Z',
    duracion_segundos: 510,
    ...extra,
  })

  it('responde el chequeo de salud y, con certificado, conecta cifrado', async () => {
    await expect(almacen.salud()).resolves.toBeUndefined()
    const [[fila]] = await pool.query<RowDataPacket[]>("SHOW SESSION STATUS LIKE 'Ssl_cipher'")
    expect(Boolean(fila?.Value)).toBe(Boolean(CA))
  })

  it('encuentra al estudiante con su fecha y distingue los otros casos', async () => {
    expect(await almacen.validarEstudiante('1037654321', '2008-05-14')).toBe('valido')
    expect(await almacen.validarEstudiante('1037654321', '2008-05-15')).toBe('fecha_incorrecta')
    expect(await almacen.validarEstudiante('99999999', '2008-05-14')).toBe('no_encontrado')
  })

  it('la misma fecha equivocada repetida no gasta intentos', async () => {
    for (let i = 0; i < 10; i++) {
      expect(await almacen.validarEstudiante('2222222222', '2000-01-01')).toBe('fecha_incorrecta')
    }
    expect(await intentos('2222222222')).toBe(1)
    expect(await almacen.validarEstudiante('2222222222', '2008-05-14')).toBe('valido')
  })

  it('cinco fechas distintas bloquean el documento, aun con la fecha correcta, y a los 15 minutos se libera', async () => {
    for (let dia = 1; dia <= 5; dia++) {
      expect(await almacen.validarEstudiante('3333333333', `2000-01-0${dia}`)).toBe('fecha_incorrecta')
    }
    expect(await almacen.validarEstudiante('3333333333', '2008-05-14')).toBe('bloqueado')
    await admin.query(
      'UPDATE intentos_validacion SET intentado_en = UTC_TIMESTAMP(3) - INTERVAL 16 MINUTE WHERE cedula = ?',
      ['3333333333'],
    )
    expect(await almacen.validarEstudiante('3333333333', '2008-05-14')).toBe('valido')
  })

  it('en paralelo no se cuelan más de cinco fechas', async () => {
    const fechas = Array.from({ length: 12 }, (_, i) => `2001-01-${String(i + 1).padStart(2, '0')}`)
    const resultados = await Promise.all(fechas.map((fecha) => almacen.validarEstudiante('4444444444', fecha)))
    expect(resultados.filter((r) => r === 'fecha_incorrecta')).toHaveLength(5)
    expect(resultados.filter((r) => r === 'bloqueado')).toHaveLength(7)
    expect(await intentos('4444444444')).toBe(5)
  })

  it('comprueba la clave cifrada', async () => {
    expect(await almacen.validarClave(CLAVE)).toBe(true)
    expect(await almacen.validarClave('otra')).toBe(false)
  })

  it('guarda a quien está en la lista con su fecha, reconoce el reintento y el número repetido', async () => {
    const equivocada = fila({ fecha_nacimiento: '2008-05-20' })
    expect(await almacen.insertar(equivocada)).toBe('no_validado')
    expect(await almacen.insertar(equivocada, { claveEncuesta: CLAVE })).toBe('no_validado')

    const buena = fila()
    expect(await almacen.insertar(buena)).toBe('creada')
    expect(await almacen.insertar(buena)).toBe('reintento')
    expect(await almacen.insertar(fila({ tipo_documento: 'cedula_ciudadania', ruta: 'trabajar' }))).toBe(
      'documento_repetido',
    )

    const [[guardada]] = await admin.query<RowDataPacket[]>('SELECT * FROM respuestas WHERE id = ?', [buena.id])
    expect(guardada.fecha_nacimiento).toBe('2008-05-14')
    expect(guardada.consentimiento_en).toBe('2026-09-18 15:00:00.000')
    expect(guardada.enviada_en).toBe('2026-09-18 15:08:30.250')
    expect(guardada.respuestas).toEqual(buena.respuestas)
  })

  it('quien no está en la lista entra solo con la clave, que no se guarda', async () => {
    const fuera = fila({ numero_documento: 'AB12345', tipo_documento: 'pasaporte' })
    expect(await almacen.insertar(fuera)).toBe('no_validado')
    expect(await almacen.insertar(fuera, { claveEncuesta: 'otra' })).toBe('no_validado')
    expect(await almacen.insertar(fuera, { claveEncuesta: CLAVE })).toBe('creada')

    const sinDocumento = () => fila({ numero_documento: null, tipo_documento: 'sin_documento' })
    expect(await almacen.insertar(sinDocumento(), { claveEncuesta: CLAVE })).toBe('creada')
    expect(await almacen.insertar(sinDocumento(), { claveEncuesta: CLAVE })).toBe('creada')

    const [[{ texto }]] = await admin.query<RowDataPacket[]>(
      'SELECT GROUP_CONCAT(JSON_UNQUOTE(respuestas)) AS texto FROM respuestas',
    )
    expect(String(texto)).not.toContain(CLAVE)
  })

  it('el envío cuenta para el mismo límite de fechas', async () => {
    for (let dia = 1; dia <= 5; dia++) {
      expect(await almacen.insertar(fila({ numero_documento: '5555555555', fecha_nacimiento: `2000-02-0${dia}` }))).toBe(
        'no_validado',
      )
    }
    expect(await almacen.insertar(fila({ numero_documento: '5555555555' }))).toBe('no_validado')
    expect(await almacen.validarEstudiante('5555555555', '2008-05-14')).toBe('bloqueado')
  })
})
