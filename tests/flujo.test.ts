import { describe, expect, it } from 'vitest'

import * as flujo from '@/lib/encuesta/flujo'
import type { Consulta, Estado } from '@/lib/encuesta/flujo'
import { PASO_VALIDACION, PREGUNTA_RUTA, pasosAplicables } from '@/lib/encuesta/logica'

import { respuestasValidas } from './utilidades'

const ID = '11111111-2222-4333-8444-555555555555'

/** Recién aceptado el aviso de datos. */
const alEmpezar = () => flujo.comenzar(flujo.estadoInicial(), '2026-09-28T15:00:00.000Z', ID)

/** Con tipo, número y fecha escritos, parado en el paso de validación. */
function enValidacion(extra: Record<string, unknown> = {}): Estado {
  let e = alEmpezar()
  e = flujo.responder(e, 'tipo_documento', 'tarjeta_identidad')
  e = flujo.responder(e, 'numero_documento', '1037654321')
  e = flujo.responder(e, PASO_VALIDACION, '2008-05-14')
  for (const [id, valor] of Object.entries(extra)) e = flujo.responder(e, id, valor)
  return flujo.irA(e, PASO_VALIDACION)
}

function consultar(e: Estado): Consulta {
  const preparado = flujo.prepararValidacion(e)
  if (preparado.tipo !== 'consultar') throw new Error('Se esperaba una consulta')
  return preparado
}

/** Validado con la lista y en la pregunta siguiente. */
function validado(): Estado {
  const e = enValidacion()
  return flujo.aplicarValidacion(e, consultar(e), 'valido', null).estado
}

describe('inicio', () => {
  it('al aceptar el aviso guarda la autorización y abre la primera pregunta', () => {
    const e = alEmpezar()
    expect(e).toMatchObject({ vista: 'encuesta', actual: 'tipo_documento', idEnvio: ID })
    expect(e.consentimientoEn).toBe('2026-09-28T15:00:00.000Z')
    expect(e.pedido).toMatchObject({ foco: 'texto-tipo_documento', alInicio: true })
  })

  it('en "Sobre ti" solo se ven sus círculos y no el porcentaje', () => {
    const e = alEmpezar()
    expect(flujo.enInicio(e)).toBe(true)
    expect(flujo.circulos(e)).toMatchObject({ lista: [{ numero: 1 }, { numero: 2 }], aviso: null })
  })

  it('sin responder no avanza: marca el error y enfoca el campo', () => {
    const { estado, enviar } = flujo.siguiente(alEmpezar())
    expect(enviar).toBe(false)
    expect(estado.actual).toBe('tipo_documento')
    expect(estado.errores.tipo_documento).toMatch(/Elige/)
    expect(estado.pedido).toMatchObject({ primerCampo: true })
    expect(flujo.estadoNumero(estado, flujo.preguntaActual(estado))).toBe('falta')
  })

  it('nada de lo que sigue a la validación se abre sin pasarla', () => {
    const e = flujo.irA(alEmpezar(), 'decision_bachillerato')
    expect(e.actual).toBe(PASO_VALIDACION)
  })
})

describe('paso de validación', () => {
  it('revisa el formato antes de consultar', () => {
    const preparado = flujo.prepararValidacion(enValidacion({ numero_documento: '12' }))
    expect(preparado.tipo).toBe('resuelto')
    if (preparado.tipo === 'resuelto') {
      expect(preparado.estado.errores.numero_documento).toMatch(/entre 4 y 15/)
      expect(preparado.estado.pedido).toMatchObject({ foco: 'numero_documento' })
    }
  })

  it('consulta la lista con el documento y la fecha', () => {
    expect(consultar(enValidacion()).datos).toEqual({
      tipo_documento: 'tarjeta_identidad',
      numero_documento: '1037654321',
      fecha_nacimiento: '2008-05-14',
    })
  })

  it('validado, pasa a la decisión y la validación cuenta como respondida', () => {
    const e = validado()
    expect(e.actual).toBe(PREGUNTA_RUTA)
    expect(e.validacion).toEqual({ via: 'lista', numero: '1037654321', fecha: '2008-05-14' })
    const paso = flujo.pasos(e).find((p) => p.id === PASO_VALIDACION)
    expect(paso && flujo.estadoNumero(e, paso)).toBe('completa')
  })

  it('si el documento no está, pide la clave sin avisos anteriores y la enfoca', () => {
    let e = enValidacion()
    e = { ...e, errores: { [PASO_VALIDACION]: 'La fecha de nacimiento no coincide' } }
    const { estado } = flujo.aplicarValidacion(e, consultar(enValidacion()), 'no_encontrado', null)
    expect(estado.pedirClave).toBe(true)
    expect(flujo.errorValidacion(estado)).toBeUndefined()
    expect(estado.pedido).toMatchObject({ foco: 'clave' })
  })

  it('una respuesta que llega después de cambiar el número no aplica', () => {
    let e = enValidacion()
    e = flujo.aplicarValidacion(e, consultar(e), 'no_encontrado', null).estado
    e = flujo.escribirClave(e, 'la-clave')
    const consulta = consultar(e)
    expect(consulta.datos).toEqual({ clave: 'la-clave' })
    e = flujo.responder(e, 'numero_documento', '11111111111')
    const { estado } = flujo.aplicarValidacion(e, consulta, 'clave_valida', null)
    expect(estado.validacion).toBeNull()
    expect(estado.actual).toBe(PASO_VALIDACION)
    expect(estado.pedirClave).toBe(false)
  })

  it('con la clave, queda ligada al número con que se pidió', () => {
    let e = enValidacion({ numero_documento: '99999999' })
    e = flujo.aplicarValidacion(e, consultar(e), 'no_encontrado', null).estado
    e = flujo.escribirClave(e, ' la-clave ')
    const { estado } = flujo.aplicarValidacion(e, consultar(e), 'clave_valida', null)
    expect(estado.validacion).toEqual({ via: 'clave', clave: 'la-clave', numero: '99999999' })
    expect(estado.actual).toBe(PREGUNTA_RUTA)
  })

  it('al pasar a "Sin Documento" se borra el error del número', () => {
    const e = flujo.prepararValidacion(enValidacion({ numero_documento: '12' }))
    if (e.tipo !== 'resuelto') throw new Error('Se esperaba un error')
    let s = flujo.irA(e.estado, 'tipo_documento')
    expect(flujo.estadoNumero(s, flujo.preguntaPorId(PASO_VALIDACION))).toBe('falta')
    s = flujo.responder(s, 'tipo_documento', 'sin_documento')
    expect(flujo.errorValidacion(s)).toBeUndefined()
    expect(flujo.estadoNumero(s, flujo.preguntaPorId(PASO_VALIDACION))).toBe('pendiente')
  })

  it('sin documento, el error viejo del número no se muestra', () => {
    const e = { ...enValidacion({ tipo_documento: 'sin_documento' }), errores: { numero_documento: 'viejo' } }
    expect(flujo.errorValidacion(e)).toBeUndefined()
  })

  it('muestra la edad que resulta de la fecha', () => {
    expect(flujo.textoEdad(enValidacion(), new Date(2026, 8, 28))).toBe('Tienes 18 años.')
  })
})

describe('recorrido y envío', () => {
  function completo(ruta = 'estudiar'): Estado {
    let e = validado()
    for (const [id, valor] of Object.entries(respuestasValidas(ruta))) e = flujo.responder(e, id, valor)
    const ultima = flujo.pasos(e).at(-1)
    return ultima ? flujo.irA(e, ultima.id) : e
  }

  it('en el último paso pide enviar, con solo lo que aplica a la ruta', () => {
    let e = completo('trabajar')
    e = flujo.responder(e, 'miedo_postsecundaria', 'costo')
    const { enviar } = flujo.siguiente(e)
    expect(enviar).toBe(true)
    const preparado = flujo.prepararEnvio(e)
    expect(preparado.tipo).toBe('enviar')
    if (preparado.tipo === 'enviar') {
      expect(preparado.cuerpo.respuestas).not.toHaveProperty('miedo_postsecundaria')
      expect(preparado.cuerpo.clave).toBeUndefined()
      expect(preparado.estado.enviando).toBe(true)
    }
  })

  it('si falta el camino, vuelve a la decisión', () => {
    let e = validado()
    e = flujo.irA(e, 'decision_bachillerato')
    const { estado, enviar } = flujo.avanzar({ ...e, actual: flujo.pasos(e).at(-1)?.id ?? null }, flujo.pasos(e).at(-1)!)
    expect(enviar).toBe(false)
    expect(estado.actual).toBe(PREGUNTA_RUTA)
    expect(estado.errores[PREGUNTA_RUTA]).toBeTruthy()
  })

  it('lo que falta se marca y se avisa con los números', () => {
    const e = completo()
    const { estado, hubo } = flujo.marcarFaltantes(e, { tiempo_formacion: 'x', mundos_interes: 'y' })
    expect(hubo).toBe(true)
    expect(estado.actual).toBe('tiempo_formacion')
    expect(estado.mensaje?.titulo).toBe('Te faltan 2 preguntas')
    expect(estado.mensaje?.texto).toMatch(/las preguntas \d+ y \d+/)
  })

  it('si el servidor pide validar otra vez, abre la clave vacía y luego vuelve al final', () => {
    // Entró con la clave, respondió todo y al enviar la clave ya no sirve.
    let e = enValidacion({ numero_documento: '99999999' })
    e = flujo.aplicarValidacion(e, consultar(e), 'no_encontrado', null).estado
    e = flujo.escribirClave(e, 'vieja')
    e = flujo.aplicarValidacion(e, consultar(e), 'clave_valida', null).estado
    for (const [id, valor] of Object.entries(respuestasValidas('estudiar', { numero_documento: '99999999' }))) {
      e = flujo.responder(e, id, valor)
    }
    const ultima = flujo.pasos(e).at(-1)!.id
    e = flujo.irA(e, ultima)

    e = flujo.envioFallido({ ...e, enviando: true }, { estado: 403, codigo: 'no_validado' })
    expect(e).toMatchObject({ actual: PASO_VALIDACION, pedirClave: true, claveEscrita: '', volverA: ultima })
    expect(e.validacion).toBeNull()
    expect(e.mensaje?.texto).toMatch(/La clave de la encuesta no funcionó/)
    expect(e.pedido).toMatchObject({ foco: 'clave' })

    e = flujo.escribirClave(e, 'nueva')
    const { estado } = flujo.aplicarValidacion(e, consultar(e), 'clave_valida', null)
    expect(estado.actual).toBe(ultima)
    expect(estado.volverA).toBeNull()
    expect(estado.mensaje).toMatchObject({ tipo: 'listo', texto: 'Ya puedes enviar tus respuestas.' })
  })

  it('un documento repetido ofrece revisar el documento', () => {
    const e = flujo.envioFallido(completo(), { estado: 409, codigo: 'documento_repetido' })
    expect(e.mensaje?.acciones).toEqual(['revisar-documento'])
  })

  it('una falla de red ofrece reintentar', () => {
    const e = flujo.envioFallido(completo(), {})
    expect(e.mensaje?.acciones).toEqual(['reintentar'])
  })

  it('al terminar muestra el código y guarda solo eso', () => {
    const e = flujo.envioExitoso(completo(), 'ABCD-1234')
    expect(e.vista).toBe('final')
    expect(flujo.aBorrador(e)).toEqual({ vista: 'final', codigo: 'ABCD-1234' })
  })
})

describe('borrador', () => {
  it('retoma la pregunta en la que iba', () => {
    const e = flujo.irA(validado(), 'decision_bachillerato')
    const retomado = flujo.restaurar(flujo.estadoInicial(), flujo.aBorrador(e), () => 'otro')
    expect(retomado).toMatchObject({ vista: 'encuesta', actual: 'decision_bachillerato', idEnvio: ID })
  })

  it('sin validación vigente, valida primero y guarda a dónde volver', () => {
    const e = flujo.irA(validado(), 'decision_bachillerato')
    const borrador = { ...flujo.aBorrador(e), validacion: null }
    const retomado = flujo.restaurar(flujo.estadoInicial(), borrador, () => 'otro')
    expect(retomado).toMatchObject({ actual: PASO_VALIDACION, volverA: 'decision_bachillerato' })
  })

  it('una pregunta que ya no aplica pasa a la siguiente que sí', () => {
    const e = { ...validado(), actual: 'institucion_en_mente' }
    const retomado = flujo.restaurar(flujo.estadoInicial(), flujo.aBorrador(e), () => 'otro')
    expect(pasosAplicables(retomado.respuestas).some((p) => p.id === retomado.actual)).toBe(true)
  })
})
