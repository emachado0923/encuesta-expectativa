/**
 * Borrador de la encuesta en sessionStorage.
 *
 * sessionStorage y no localStorage: el borrador sobrevive a recargar la página
 * o a que el celular suspenda la pestaña, pero se borra al cerrarla. En una sala
 * de sistemas, el siguiente estudiante no encuentra los datos del anterior.
 */

import type { Borrador, Validacion, Vista } from '@/lib/encuesta/flujo'
import { INSTRUMENTO, PREGUNTAS } from '@/lib/encuesta/instrumento'
import type { Pregunta } from '@/lib/encuesta/instrumento'
import type { Respuestas } from '@/lib/encuesta/logica'

const CLAVE = `encuesta:${INSTRUMENTO.id}`
const PREGUNTA_POR_ID = new Map(PREGUNTAS.map((pregunta) => [pregunta.id, pregunta]))
const VISTAS: readonly Vista[] = ['bienvenida', 'politicas', 'encuesta', 'final']

function valorConocido(pregunta: Pregunta, valor: unknown): boolean {
  const opciones = (pregunta.opciones ?? []).map(([opcion]) => opcion)
  if (pregunta.tipo === 'unica') return typeof valor === 'string' && opciones.includes(valor)
  if (pregunta.tipo === 'multiple') {
    return Array.isArray(valor) && valor.every((opcion) => opciones.includes(opcion))
  }
  return typeof valor === 'string'
}

const texto = (valor: unknown) => (typeof valor === 'string' ? valor : null)

/** La validación guardada: con la lista (documento y fecha) o con la clave. */
function validacionConocida(validacion: unknown): Validacion | null {
  const v = validacion as Record<string, unknown> | null
  if (v?.via === 'lista' && typeof v.numero === 'string' && typeof v.fecha === 'string') {
    return { via: 'lista', numero: v.numero, fecha: v.fecha }
  }
  if (v?.via === 'clave' && typeof v.clave === 'string') {
    return { via: 'clave', clave: v.clave, numero: texto(v.numero) }
  }
  return null
}

/**
 * Si el cuestionario cambió entre una visita y otra, se conservan las
 * respuestas que siguen existiendo y se descartan las demás.
 */
function sanear(borrador: Record<string, unknown>): Borrador {
  const respuestas: Respuestas = {}
  for (const [id, valor] of Object.entries((borrador.respuestas as Respuestas | undefined) ?? {})) {
    const pregunta = PREGUNTA_POR_ID.get(id)
    if (pregunta && valorConocido(pregunta, valor)) respuestas[id] = valor
  }
  const conocida = (id: unknown) => (typeof id === 'string' && PREGUNTA_POR_ID.has(id) ? id : null)
  const omitidas = Array.isArray(borrador.omitidas) ? borrador.omitidas : []
  return {
    vista: VISTAS.includes(borrador.vista as Vista) ? (borrador.vista as Vista) : 'bienvenida',
    respuestas,
    omitidas: omitidas.filter((id): id is string => typeof id === 'string' && PREGUNTA_POR_ID.has(id)),
    actual: conocida(borrador.actual),
    consentimientoEn: texto(borrador.consentimientoEn),
    iniciadaEn: texto(borrador.iniciadaEn),
    idEnvio: texto(borrador.idEnvio),
    codigo: texto(borrador.codigo),
    validacion: validacionConocida(borrador.validacion),
    volverA: conocida(borrador.volverA),
  }
}

export function leerBorrador(): Borrador | null {
  try {
    const borrador = JSON.parse(window.sessionStorage.getItem(CLAVE) ?? 'null')
    return borrador?.formato === 1 ? sanear(borrador) : null
  } catch {
    return null
  }
}

export function guardarBorrador(datos: Borrador): void {
  try {
    window.sessionStorage.setItem(CLAVE, JSON.stringify({ formato: 1, ...datos }))
  } catch {
    // Navegación privada o almacenamiento lleno: la encuesta sigue funcionando sin borrador.
  }
}

export function borrarBorrador(): void {
  try {
    window.sessionStorage.removeItem(CLAVE)
  } catch {
    // Sin efecto si el almacenamiento no está disponible.
  }
}
