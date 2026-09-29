import { describe, expect, it } from 'vitest'

import { PREGUNTAS, SECCIONES } from '@/lib/encuesta/instrumento'
import type { Pregunta } from '@/lib/encuesta/instrumento'
import {
  PASO_VALIDACION,
  RANGO_PREGUNTAS,
  calcularAvance,
  edadDe,
  limpiarDocumento,
  pasosAplicables,
  preguntasAplicables,
  rutaDefinida,
  validarEnvio,
  validarRespuesta,
} from '@/lib/encuesta/logica'

import { respuestasValidas } from './utilidades'

const pregunta = (id: string): Pregunta => {
  const encontrada = PREGUNTAS.find((p) => p.id === id)
  if (!encontrada) throw new Error(`No existe la pregunta ${id}`)
  return encontrada
}
// Preguntas que se guardan por ruta (los pasos que se ven son una menos: el número va con la fecha).
const RUTAS = { estudiar: 19, trabajar: 14, estudiar_trabajar: 18, indefinido: 13 }

describe('instrumento', () => {
  it('tiene las 51 preguntas del PDF, repartidas como en el PDF', () => {
    const porSeccion = Object.fromEntries(
      SECCIONES.map((s) => [s.id, PREGUNTAS.filter((p) => p.seccion === s.id).length]),
    )
    expect(PREGUNTAS).toHaveLength(51)
    expect(porSeccion).toEqual({
      caracterizacion: 3,
      corte_inicial: 2,
      ruta_estudiar: 14,
      ruta_trabajar: 10,
      ruta_mixta: 13,
      ruta_indefinida: 9,
    })
  })

  it('no repite valores de opción dentro de una pregunta', () => {
    for (const p of PREGUNTAS.filter((q) => q.opciones)) {
      const valores = (p.opciones ?? []).map(([valor]) => valor)
      expect(new Set(valores).size, p.id).toBe(valores.length)
    }
  })

  it('una pregunta repetida entre rutas conserva tipo y valores', () => {
    const porId = new Map<string, string>()
    for (const p of PREGUNTAS) {
      const firma = JSON.stringify([p.tipo, p.opciones?.map(([valor]) => valor)])
      if (porId.has(p.id)) expect(firma, p.id).toBe(porId.get(p.id))
      porId.set(p.id, firma)
    }
  })

  it('cada persona ve entre 12 y 18 pasos', () => {
    expect(RANGO_PREGUNTAS).toEqual({ minimo: 12, maximo: 18 })
  })
})

describe('ruteo', () => {
  it('antes de elegir camino solo aplican caracterización y corte inicial', () => {
    expect(preguntasAplicables({}).map((p) => p.seccion)).toEqual([
      'caracterizacion',
      'caracterizacion',
      'caracterizacion',
      'corte_inicial',
    ])
    expect(rutaDefinida({})).toBe(false)
  })

  it.each(Object.entries(RUTAS))('la ruta %s tiene %i preguntas', (ruta, total) => {
    expect(preguntasAplicables({ decision_bachillerato: ruta })).toHaveLength(total)
  })

  it('quien no tiene documento no ve la pregunta del número', () => {
    const ids = preguntasAplicables({ tipo_documento: 'sin_documento' }).map((p) => p.id)
    expect(ids).not.toContain('numero_documento')
  })

  it('el tipo de institución solo se pregunta a quien va a estudiar', () => {
    const conInstitucion = (ruta: string) =>
      preguntasAplicables({ decision_bachillerato: ruta }).some((p) => p.id === 'tipo_institucion')
    expect(conInstitucion('estudiar')).toBe(true)
    expect(conInstitucion('estudiar_trabajar')).toBe(true)
    expect(conInstitucion('trabajar')).toBe(false)
    expect(conInstitucion('indefinido')).toBe(false)
  })

  it('el número de documento va dentro del paso de validación, que es la fecha', () => {
    expect(PASO_VALIDACION).toBe('fecha_nacimiento')
    const pasos = pasosAplicables({ tipo_documento: 'tarjeta_identidad' }).map((p) => p.id)
    expect(pasos.slice(0, 3)).toEqual(['tipo_documento', 'fecha_nacimiento', 'decision_bachillerato'])
    expect(preguntasAplicables({ tipo_documento: 'tarjeta_identidad' }).map((p) => p.id)).toContain('numero_documento')
  })
})

describe('validación de respuestas', () => {
  it('pide respuesta en las obligatorias y deja pasar las opcionales vacías', () => {
    expect(validarRespuesta(pregunta('tipo_documento'), undefined, {})).toMatch(/Elige/)
    expect(validarRespuesta(pregunta('tipo_institucion'), [], {})).toMatch(/Marca/)
    expect(validarRespuesta(pregunta('institucion_en_mente'), '  ', {})).toBeNull()
  })

  it('rechaza opciones que no existen', () => {
    expect(validarRespuesta(pregunta('tipo_documento'), 'licencia', {})).toBeTruthy()
    expect(validarRespuesta(pregunta('mundos_interes'), ['digital', 'otro'], {})).toBeTruthy()
    expect(validarRespuesta(pregunta('mundos_interes'), ['digital', 'digital'], {})).toBeTruthy()
  })

  it('el número de documento sigue el formato del tipo', () => {
    const numero = pregunta('numero_documento')
    const ti = { tipo_documento: 'tarjeta_identidad' }
    const pasaporte = { tipo_documento: 'pasaporte' }
    expect(validarRespuesta(numero, '1.037.654.321', ti)).toBeNull()
    expect(validarRespuesta(numero, 'AB123456', ti)).toMatch(/solo números/)
    expect(validarRespuesta(numero, 'ab 123456', pasaporte)).toBeNull()
    expect(validarRespuesta(numero, '12', pasaporte)).toBeTruthy()
    expect(validarRespuesta(numero, '123456', {})).toMatch(/tipo de documento/)
    expect(limpiarDocumento('ab 12.34')).toBe('AB1234')
  })

  it('la fecha debe existir y estar en el rango', () => {
    const fecha = pregunta('fecha_nacimiento')
    expect(validarRespuesta(fecha, '2008-05-14', {})).toBeNull()
    expect(validarRespuesta(fecha, '2008-02-30', {})).toBeTruthy()
    expect(validarRespuesta(fecha, '14/05/2008', {})).toBeTruthy()
    expect(validarRespuesta(fecha, '1950-01-01', {})).toMatch(/rango/)
    // Hasta hoy: la fecha la confirma la lista o, con la clave, la edad que se muestra.
    expect(validarRespuesta(fecha, '2026-09-01', {})).toBeNull()
    expect(validarRespuesta(fecha, '2999-01-01', {})).toMatch(/posterior a hoy/)
  })

  it('la edad que se muestra al validar cuenta los años ya cumplidos', () => {
    const hoy = new Date(2026, 8, 22) // 22 de septiembre de 2026
    expect(edadDe('2008-09-22', hoy)).toBe(18)
    expect(edadDe('2008-09-23', hoy)).toBe(17)
    expect(edadDe('2009-01-01', hoy)).toBe(17)
    expect(edadDe('2008-02-29', new Date(2026, 1, 28))).toBe(17)
    expect(edadDe('2008-02-29', new Date(2026, 2, 1))).toBe(18)
  })
})

describe('envío completo', () => {
  it.each(Object.keys(RUTAS))('acepta una respuesta completa por la ruta %s', (ruta) => {
    expect(validarEnvio(respuestasValidas(ruta)).errores).toEqual({})
  })

  it('descarta lo respondido en una ruta abandonada', () => {
    const respuestas = { ...respuestasValidas('trabajar'), miedo_postsecundaria: 'costo' }
    const { limpias, errores } = validarEnvio(respuestas)
    expect(errores).toEqual({})
    expect(limpias).not.toHaveProperty('miedo_postsecundaria')
  })

  it('acepta a quien no tiene documento, sin número', () => {
    const respuestas = respuestasValidas('indefinido', {
      tipo_documento: 'sin_documento',
      numero_documento: undefined,
    })
    const { limpias, errores } = validarEnvio(respuestas)
    expect(errores).toEqual({})
    expect(limpias).not.toHaveProperty('numero_documento')
  })

  it('guarda el documento normalizado y el texto sin espacios sobrantes', () => {
    const respuestas = {
      ...respuestasValidas('estudiar', { numero_documento: '1.037.654.321' }),
      programa_en_mente: '  Estadística  ',
    }
    const { limpias } = validarEnvio(respuestas)
    expect(limpias.numero_documento).toBe('1037654321')
    expect(limpias.programa_en_mente).toBe('Estadística')
  })

  it('no acepta algo que no sea un objeto', () => {
    expect(validarEnvio(null).errores).toHaveProperty('_general')
    expect(validarEnvio([]).errores).toHaveProperty('_general')
  })
})

describe('avance', () => {
  it('cuenta solo respuestas válidas', () => {
    const avance = calcularAvance({ tipo_documento: 'tarjeta_identidad', numero_documento: '12' })
    expect(avance.completas).toBe(1)
  })

  it('antes de elegir camino estima con la ruta más corta', () => {
    expect(calcularAvance({}).total).toBe(12)
    expect(calcularAvance({ decision_bachillerato: 'estudiar' }).total).toBe(18)
  })

  it('una opcional omitida cuenta como completa', () => {
    const respuestas = respuestasValidas('estudiar')
    expect(calcularAvance(respuestas).completas).toBe(16)
    const omitidas = new Set(['institucion_en_mente', 'programa_en_mente'])
    expect(calcularAvance(respuestas, omitidas)).toMatchObject({ completas: 18, porcentaje: 100 })
  })
})
