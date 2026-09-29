/**
 * Reglas del recorrido: qué preguntas aplican, cuándo una respuesta es válida y
 * cuánto falta. El navegador las usa para guiar a quien responde y el servidor
 * para decidir qué se guarda, así que los dos validan igual.
 */

import { FORMATO_DOCUMENTO, PREGUNTAS, SECCIONES } from './instrumento'
import type { Condicion, FormatoDocumento, Pregunta, Seccion } from './instrumento'

/** Un valor de respuesta: opción única, texto o fecha (string) u opciones múltiples (string[]). */
export type Valor = string | string[]

/** Respuestas por id de pregunta. Llegan del navegador, así que pueden traer cualquier cosa. */
export type Respuestas = Record<string, unknown>

const SECCION_POR_ID = new Map(SECCIONES.map((seccion) => [seccion.id, seccion]))

function preguntaMarcada(marca: 'ramifica' | 'validacion'): Pregunta {
  const pregunta = PREGUNTAS.find((p) => p[marca])
  if (!pregunta) throw new Error(`El instrumento no tiene una pregunta con "${marca}".`)
  return pregunta
}

const PREGUNTA_QUE_RAMIFICA = preguntaMarcada('ramifica')

/** La pregunta del corte inicial que abre una de las cuatro rutas. */
export const PREGUNTA_RUTA = PREGUNTA_QUE_RAMIFICA.id
export const RUTAS: readonly string[] = (PREGUNTA_QUE_RAMIFICA.opciones ?? []).map(([valor]) => valor)

/** El paso donde se valida a quien responde: su documento y su fecha de nacimiento. */
export const PASO_VALIDACION = preguntaMarcada('validacion').id

const SECCIONES_DE_RUTA = SECCIONES.filter((s) => s.mostrarSi?.pregunta === PREGUNTA_RUTA)

const PATRON_DOCUMENTO: Record<FormatoDocumento, RegExp> = {
  numerico: /^\d{4,15}$/,
  alfanumerico: /^[A-Z0-9][A-Z0-9-]{2,18}[A-Z0-9]$/,
}

function cumple(condicion: Condicion | undefined, respuestas: Respuestas): boolean {
  if (!condicion) return true
  const valor = respuestas[condicion.pregunta]
  if (condicion.en) return typeof valor === 'string' && condicion.en.includes(valor)
  if (condicion.noEn) return !(typeof valor === 'string' && condicion.noEn.includes(valor))
  return true
}

export function seccionDe(pregunta: Pregunta): Seccion {
  const seccion = SECCION_POR_ID.get(pregunta.seccion)
  if (!seccion) throw new Error(`La pregunta ${pregunta.id} tiene una sección desconocida.`)
  return seccion
}

/** Preguntas que aplican con las respuestas actuales, en el orden del instrumento. */
export function preguntasAplicables(respuestas: Respuestas): Pregunta[] {
  return PREGUNTAS.filter(
    (pregunta) =>
      cumple(seccionDe(pregunta).mostrarSi, respuestas) && cumple(pregunta.mostrarSi, respuestas),
  )
}

/**
 * Los pasos que ve quien responde: las preguntas que aplican menos las que se
 * piden dentro del paso de validación (el número de documento va con la fecha).
 */
export function pasosAplicables(respuestas: Respuestas): Pregunta[] {
  return preguntasAplicables(respuestas).filter((pregunta) => !pregunta.enValidacion)
}

/** Cuántos pasos ve una persona según la ruta que elige: entre 12 y 18. */
export const RANGO_PREGUNTAS = (() => {
  const porRuta = RUTAS.map((ruta) => pasosAplicables({ [PREGUNTA_RUTA]: ruta }).length)
  return { minimo: Math.min(...porRuta), maximo: Math.max(...porRuta) }
})()

export function rutaDefinida(respuestas: Respuestas): boolean {
  return SECCIONES_DE_RUTA.some((seccion) => cumple(seccion.mostrarSi, respuestas))
}

export function estaRespondida(valor: unknown): boolean {
  if (valor === undefined || valor === null) return false
  if (Array.isArray(valor)) return valor.length > 0
  return String(valor).trim() !== ''
}

/** Quita lo que suele escribirse como formato: espacios, puntos y comas. */
export function limpiarDocumento(valor: unknown): string {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/[\s.,]/g, '')
}

export function formatoDocumento(respuestas: Respuestas): FormatoDocumento | null {
  const tipo = respuestas.tipo_documento
  return typeof tipo === 'string' ? (FORMATO_DOCUMENTO[tipo] ?? null) : null
}

function fechaReal(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const [anio, mes, dia] = texto.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
}

/** La fecha de hoy (AAAA-MM-DD) según el reloj de quien la calcula. */
export function hoyIso(ahora: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`
}

function mensajeFalta(pregunta: Pregunta): string {
  if (pregunta.tipo === 'unica') return 'Elige una opción para continuar.'
  if (pregunta.tipo === 'multiple') return 'Marca al menos una opción para continuar.'
  if (pregunta.tipo === 'fecha') return 'Escribe la fecha para continuar.'
  return 'Escribe tu respuesta para continuar.'
}

/** Devuelve el mensaje de error de una respuesta, o null si es válida. */
export function validarRespuesta(pregunta: Pregunta, valor: unknown, respuestas: Respuestas): string | null {
  if (!estaRespondida(valor)) {
    return pregunta.obligatoria === false ? null : mensajeFalta(pregunta)
  }

  switch (pregunta.tipo) {
    case 'unica':
      return typeof valor === 'string' && (pregunta.opciones ?? []).some(([opcion]) => opcion === valor)
        ? null
        : 'Elige una de las opciones.'

    case 'multiple': {
      const validas = new Set((pregunta.opciones ?? []).map(([opcion]) => opcion))
      const correcta =
        Array.isArray(valor) &&
        valor.every((opcion) => typeof opcion === 'string' && validas.has(opcion)) &&
        new Set(valor).size === valor.length
      return correcta ? null : 'Hay opciones que no son válidas.'
    }

    case 'texto':
      if (typeof valor !== 'string') return 'La respuesta debe ser un texto.'
      if (pregunta.maxLongitud && valor.trim().length > pregunta.maxLongitud) {
        return `Usa máximo ${pregunta.maxLongitud} caracteres.`
      }
      return null

    case 'fecha':
      if (typeof valor !== 'string' || !fechaReal(valor)) return 'Escribe una fecha válida.'
      if ((pregunta.min && valor < pregunta.min) || (pregunta.max && valor > pregunta.max)) {
        return 'Revisa el año: la fecha está fuera del rango esperado.'
      }
      if (valor > hoyIso()) return 'La fecha no puede ser posterior a hoy.'
      return null

    case 'documento': {
      const formato = formatoDocumento(respuestas)
      if (!formato) return 'Primero elige el tipo de documento.'
      if (typeof valor !== 'string') return 'Escribe el número de tu documento.'
      if (PATRON_DOCUMENTO[formato].test(limpiarDocumento(valor))) return null
      return formato === 'numerico'
        ? 'Escribe solo números: entre 4 y 15 dígitos.'
        : 'Usa letras, números o guiones: entre 4 y 20 caracteres.'
    }

    default:
      return 'Tipo de pregunta desconocido.'
  }
}

/** Años cumplidos en `hoy` por quien nació en `fecha` (AAAA-MM-DD). */
export function edadDe(fecha: string, hoy: Date = new Date()): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const mesHoy = hoy.getMonth() + 1
  const cumplioEsteAnio = mesHoy > mes || (mesHoy === mes && hoy.getDate() >= dia)
  return hoy.getFullYear() - anio - (cumplioEsteAnio ? 0 : 1)
}

/** La pregunta está lista para contar en el avance. */
export function estaCompleta(pregunta: Pregunta, respuestas: Respuestas, omitidas: ReadonlySet<string>): boolean {
  const valor = respuestas[pregunta.id]
  if (!estaRespondida(valor)) return pregunta.obligatoria === false && omitidas.has(pregunta.id)
  return validarRespuesta(pregunta, valor, respuestas) === null
}

/**
 * Avance sobre los pasos que aplican. Mientras no se ha elegido ruta, el total
 * es el de la ruta más corta: la barra no promete de más y, al elegir, el total
 * solo puede crecer un poco en lugar de dar un salto hacia atrás.
 */
export function calcularAvance(respuestas: Respuestas, omitidas: ReadonlySet<string> = new Set()) {
  const pasos = pasosAplicables(respuestas)
  const completas = pasos.filter((p) => estaCompleta(p, respuestas, omitidas)).length
  const total = rutaDefinida(respuestas)
    ? pasos.length
    : Math.min(...RUTAS.map((ruta) => pasosAplicables({ ...respuestas, [PREGUNTA_RUTA]: ruta }).length))
  return { completas, total, porcentaje: Math.round((completas / total) * 100) }
}

function valorLimpio(pregunta: Pregunta, valor: unknown): unknown {
  if (pregunta.tipo === 'documento') return limpiarDocumento(valor)
  if (typeof valor === 'string') return valor.trim()
  return valor
}

/**
 * Valida un envío completo. Devuelve las respuestas limpias de las preguntas
 * que aplican (lo demás se descarta: una ruta abandonada no deja rastro) y los
 * errores por pregunta.
 */
export function validarEnvio(respuestas: unknown): { limpias: Record<string, Valor>; errores: Record<string, string> } {
  if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) {
    return { limpias: {}, errores: { _general: 'Las respuestas no tienen el formato esperado.' } }
  }

  const entrada = respuestas as Respuestas
  const limpias: Record<string, Valor> = {}
  const errores: Record<string, string> = {}
  for (const pregunta of preguntasAplicables(entrada)) {
    const valor = entrada[pregunta.id]
    const error = validarRespuesta(pregunta, valor, entrada)
    if (error) errores[pregunta.id] = error
    else if (estaRespondida(valor)) limpias[pregunta.id] = valorLimpio(pregunta, valor) as Valor
  }
  return { limpias, errores }
}
