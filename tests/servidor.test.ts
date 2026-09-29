import { describe, expect, it, vi } from 'vitest'

import type { Almacen } from '@/servidor/almacen'
import { claveCoincide, cifrarClave } from '@/servidor/clave'
import { leerConfiguracionMysql } from '@/servidor/configuracion'
import { codigoRegistro, procesarEnvio } from '@/servidor/enviar'
import { leerJson } from '@/servidor/http'
import { procesarValidacion } from '@/servidor/validar'

import { CLAVE_PRUEBA, almacenEnMemoria, envioValido } from './utilidades'

describe('procesarEnvio', () => {
  it('guarda una respuesta válida y devuelve el código', async () => {
    const almacen = almacenEnMemoria()
    const envio = envioValido('estudiar')
    const { estado, cuerpo } = await procesarEnvio(envio, { almacen })
    expect(estado).toBe(201)
    expect(cuerpo.codigo).toBe(codigoRegistro(envio.id))
    const fila = almacen.filas.get(envio.id)
    expect(fila).toMatchObject({ ruta: 'estudiar', numero_documento: '1037654321', duracion_segundos: expect.any(Number) })
  })

  it('un reintento del mismo envío no duplica y responde bien', async () => {
    const almacen = almacenEnMemoria()
    const envio = envioValido('trabajar')
    expect((await procesarEnvio(envio, { almacen })).estado).toBe(201)
    const otraVez = await procesarEnvio(envio, { almacen })
    expect(otraVez.estado).toBe(200)
    expect(almacen.filas.size).toBe(1)
  })

  it('un documento que ya respondió recibe 409', async () => {
    const almacen = almacenEnMemoria()
    await procesarEnvio(envioValido('estudiar'), { almacen })
    const { estado, cuerpo } = await procesarEnvio(envioValido('trabajar'), { almacen })
    expect(estado).toBe(409)
    expect(cuerpo.codigo).toBe('documento_repetido')
  })

  it('dos personas sin documento, con la clave, no chocan entre sí', async () => {
    const almacen = almacenEnMemoria()
    const sinDocumento = { tipo_documento: 'sin_documento', numero_documento: undefined }
    const conClave = (envio: object) => ({ ...envio, clave: CLAVE_PRUEBA })
    expect((await procesarEnvio(conClave(envioValido('indefinido', sinDocumento)), { almacen })).estado).toBe(201)
    expect((await procesarEnvio(conClave(envioValido('estudiar', sinDocumento)), { almacen })).estado).toBe(201)
  })

  it('rechaza con 403 a quien no está en la lista ni trae la clave', async () => {
    const almacen = almacenEnMemoria()
    const fuera = envioValido('estudiar', { numero_documento: '99999999' })
    const { estado, cuerpo } = await procesarEnvio(fuera, { almacen })
    expect(estado).toBe(403)
    expect(cuerpo.codigo).toBe('no_validado')
    const otraFecha = envioValido('estudiar', { fecha_nacimiento: '2008-05-15' })
    expect((await procesarEnvio(otraFecha, { almacen })).estado).toBe(403)
    const claveMala = { ...envioValido('estudiar', { numero_documento: '99999999' }), clave: 'otra' }
    expect((await procesarEnvio(claveMala, { almacen })).estado).toBe(403)
    expect(almacen.filas.size).toBe(0)
  })

  it('la clave no sirve para un documento de la lista con otra fecha', async () => {
    const almacen = almacenEnMemoria()
    const ajeno = { ...envioValido('estudiar', { fecha_nacimiento: '2010-01-01' }), clave: CLAVE_PRUEBA }
    const { estado, cuerpo } = await procesarEnvio(ajeno, { almacen })
    expect(estado).toBe(403)
    expect(cuerpo.codigo).toBe('no_validado')
  })

  it('el mismo número con otro tipo de documento cuenta como repetido', async () => {
    const almacen = almacenEnMemoria()
    expect((await procesarEnvio(envioValido('estudiar'), { almacen })).estado).toBe(201)
    const otroTipo = envioValido('trabajar', { tipo_documento: 'cedula_ciudadania' })
    const { estado, cuerpo } = await procesarEnvio(otroTipo, { almacen })
    expect(estado).toBe(409)
    expect(cuerpo.codigo).toBe('documento_repetido')
  })

  it('con la clave responde quien no está en la lista, y la clave no queda en la fila', async () => {
    const almacen = almacenEnMemoria()
    const envio = { ...envioValido('trabajar', { numero_documento: '99999999' }), clave: `  ${CLAVE_PRUEBA} ` }
    expect((await procesarEnvio(envio, { almacen })).estado).toBe(201)
    const fila = almacen.filas.get(envio.id)
    expect(JSON.stringify(fila)).not.toContain(CLAVE_PRUEBA)
  })

  it('devuelve los errores por pregunta', async () => {
    const envio = envioValido('estudiar', { tiempo_formacion: 'diez_anos' })
    const { estado, cuerpo } = await procesarEnvio(envio, { almacen: almacenEnMemoria() })
    expect(estado).toBe(422)
    expect(cuerpo.errores).toHaveProperty('tiempo_formacion')
  })

  it.each([
    ['sin id', { id: 'abc' }, 400],
    ['sin consentimiento', { consentimientoEn: null }, 400],
    ['otro formulario', { instrumento: 'otra' }, 400],
    ['versión vieja', { version: '2025.1' }, 409],
  ])('rechaza un envío %s', async (_, cambio, esperado) => {
    const envio = { ...envioValido('estudiar'), ...cambio }
    expect((await procesarEnvio(envio, { almacen: almacenEnMemoria() })).estado).toBe(esperado)
  })

  it('si el almacén falla responde 503, que el navegador reintenta', async () => {
    const almacen = { insertar: () => Promise.reject(new Error('caído')) }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await procesarEnvio(envioValido('estudiar'), { almacen })).estado).toBe(503)
  })
})

describe('procesarValidacion', () => {
  const datos = (extra: Record<string, unknown> = {}) => ({
    tipo_documento: 'tarjeta_identidad',
    numero_documento: '1.037.654.321',
    fecha_nacimiento: '2008-05-14',
    ...extra,
  })
  const validar = (cuerpo: unknown, almacen: Almacen = almacenEnMemoria()) => procesarValidacion(cuerpo, { almacen })

  it('encuentra al estudiante de la lista con su fecha (el número se limpia)', async () => {
    expect(await validar(datos())).toEqual({ estado: 200, cuerpo: { resultado: 'valido' } })
  })

  it('distingue fecha equivocada de documento que no está', async () => {
    expect((await validar(datos({ fecha_nacimiento: '2008-05-15' }))).cuerpo.resultado).toBe('fecha_incorrecta')
    expect((await validar(datos({ numero_documento: '99999999' }))).cuerpo.resultado).toBe('no_encontrado')
  })

  it('sin documento no consulta la lista: solo entra con la clave', async () => {
    const almacen = { ...almacenEnMemoria(), validarEstudiante: vi.fn() }
    const { cuerpo } = await validar(datos({ tipo_documento: 'sin_documento', numero_documento: undefined }), almacen)
    expect(cuerpo.resultado).toBe('no_encontrado')
    expect(almacen.validarEstudiante).not.toHaveBeenCalled()
  })

  it('comprueba la clave sin los espacios de los extremos', async () => {
    expect((await validar({ clave: ` ${CLAVE_PRUEBA} ` })).cuerpo.resultado).toBe('clave_valida')
    expect((await validar({ clave: 'otra' })).cuerpo.resultado).toBe('clave_incorrecta')
    expect((await validar({ clave: '   ' })).estado).toBe(400)
    expect((await validar({ clave: 'x'.repeat(101) })).estado).toBe(400)
  })

  it('revisa el formato antes de consultar', async () => {
    const { estado, cuerpo } = await validar(datos({ numero_documento: 'AB', fecha_nacimiento: '2999-01-01' }))
    expect(estado).toBe(422)
    expect(cuerpo.errores).toHaveProperty('numero_documento')
    expect(cuerpo.errores).toHaveProperty('fecha_nacimiento')
    expect((await validar(null)).estado).toBe(400)
    expect((await validar([])).estado).toBe(400)
  })

  it('si la base falla responde 503', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const caido: Almacen = {
      insertar: () => Promise.reject(new Error('caído')),
      validarEstudiante: () => Promise.reject(new Error('caído')),
      validarClave: () => Promise.reject(new Error('caído')),
      salud: () => Promise.reject(new Error('caído')),
    }
    expect((await validar(datos(), caido)).estado).toBe(503)
    expect((await validar({ clave: 'x' }, caido)).estado).toBe(503)
  })
})

describe('clave cifrada', () => {
  it('guarda un hash que no contiene la clave y la reconoce', async () => {
    const hash = await cifrarClave('sapiencia2026*')
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/)
    expect(hash).not.toContain('sapiencia2026')
    expect(await claveCoincide('sapiencia2026*', hash)).toBe(true)
    expect(await claveCoincide('sapiencia2026', hash)).toBe(false)
  })

  it('dos hashes de la misma clave son distintos (sal al azar)', async () => {
    expect(await cifrarClave('misma')).not.toBe(await cifrarClave('misma'))
  })

  it('un hash con otro formato nunca coincide', async () => {
    expect(await claveCoincide('sapiencia2026*', 'sapiencia2026*')).toBe(false)
    expect(await claveCoincide('x', 'scrypt$0$8$1$abc$def')).toBe(false)
    expect(await claveCoincide('x', 'scrypt$16384$8$1$$')).toBe(false)
  })
})

describe('lectura del cuerpo', () => {
  const pedir = (cuerpo: string, encabezados: Record<string, string> = {}) =>
    new Request('http://localhost/api', { method: 'POST', body: cuerpo, headers: encabezados })

  it('lee JSON y deja pasar el JSON mal formado como undefined', async () => {
    expect(await leerJson(pedir('{"a":1}'), 100)).toEqual({ cuerpo: { a: 1 } })
    expect(await leerJson(pedir('{no'), 100)).toEqual({ cuerpo: undefined })
  })

  it('corta con 413 lo que pasa del tope, con o sin Content-Length', async () => {
    const grande = JSON.stringify({ x: 'y'.repeat(200) })
    const conLargo = await leerJson(pedir(grande, { 'content-length': String(grande.length) }), 100)
    expect('error' in conLargo && conLargo.error.status).toBe(413)
    const sinLargo = await leerJson(pedir(grande), 100)
    expect('error' in sinLargo && sinLargo.error.status).toBe(413)
  })
})

describe('configuración de MySQL', () => {
  it('pide servidor, usuario y base; lo demás tiene valores por defecto', () => {
    expect(leerConfiguracionMysql({ MYSQL_HOST: 'h', MYSQL_USER: 'u' })).toBeNull()
    expect(
      leerConfiguracionMysql({ MYSQL_HOST: 'h', MYSQL_USER: 'u', MYSQL_DATABASE: 'b' }),
    ).toEqual({
      host: 'h',
      port: 3306,
      user: 'u',
      password: '',
      database: 'b',
      ssl: false,
      certificadoCa: null,
      conexiones: 10,
    })
    expect(
      leerConfiguracionMysql({
        MYSQL_HOST: 'h',
        MYSQL_USER: 'u',
        MYSQL_DATABASE: 'b',
        MYSQL_PORT: '3307',
        MYSQL_SSL: 'true',
        MYSQL_CONEXIONES: 'muchas',
      }),
    ).toMatchObject({ port: 3307, ssl: true, conexiones: 10 })
  })

  it('con el certificado de la autoridad, la conexión va cifrada', () => {
    expect(
      leerConfiguracionMysql({ MYSQL_HOST: 'h', MYSQL_USER: 'u', MYSQL_DATABASE: 'b', MYSQL_SSL_CA: '/ruta/server-ca.pem' }),
    ).toMatchObject({ ssl: true, certificadoCa: '/ruta/server-ca.pem' })
  })
})
