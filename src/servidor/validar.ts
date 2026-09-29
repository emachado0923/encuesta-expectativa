/**
 * Validación de quién responde, antes de las preguntas. Dos formas:
 *
 * - { tipo_documento, numero_documento, fecha_nacimiento }: busca el documento
 *   en la lista de estudiantes y compara la fecha de nacimiento.
 * - { clave }: para quien no está en la lista.
 *
 * El envío final vuelve a comprobar lo mismo (ver enviar.ts). Esto solo evita
 * que alguien conteste toda la encuesta para enterarse al final de que no puede.
 */

import { PREGUNTAS } from '@/lib/encuesta/instrumento'
import { limpiarDocumento, validarRespuesta } from '@/lib/encuesta/logica'

import type { Almacen, ResultadoEstudiante } from './almacen'

const PREGUNTA_POR_ID = new Map(PREGUNTAS.map((pregunta) => [pregunta.id, pregunta]))
const CAMPOS = ['tipo_documento', 'numero_documento', 'fecha_nacimiento'] as const
const RESULTADOS = new Set<ResultadoEstudiante>(['valido', 'fecha_incorrecta', 'no_encontrado', 'bloqueado'])

/** Más larga que cualquier clave razonable; lo demás es basura. */
export const LARGO_MAXIMO_CLAVE = 100

export type Respuesta = { estado: number; cuerpo: Record<string, unknown> }

/** La clave tal como se compara: sin los espacios que agregan algunos teclados. */
export function limpiarClave(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const clave = valor.trim()
  return clave && clave.length <= LARGO_MAXIMO_CLAVE ? clave : null
}

const respuesta = (estado: number, cuerpo: Record<string, unknown>): Respuesta => ({ estado, cuerpo })
const NO_DISPONIBLE = respuesta(503, { error: 'No pudimos validar tus datos en este momento. Vuelve a intentarlo.' })

async function consultar<T>(accion: () => Promise<T>): Promise<{ resultado: T } | { fallo: Respuesta }> {
  try {
    return { resultado: await accion() }
  } catch (error) {
    console.error('[validar] no se pudo consultar', error)
    return { fallo: NO_DISPONIBLE }
  }
}

export async function procesarValidacion(cuerpo: unknown, { almacen }: { almacen: Almacen }): Promise<Respuesta> {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return respuesta(400, { error: 'La solicitud no tiene el formato esperado.' })
  }
  const entrada = cuerpo as Record<string, unknown>

  if ('clave' in entrada) {
    const clave = limpiarClave(entrada.clave)
    if (!clave) return respuesta(400, { error: 'Escribe la clave de la encuesta.' })
    const consulta = await consultar(() => almacen.validarClave(clave))
    if ('fallo' in consulta) return consulta.fallo
    return respuesta(200, { resultado: consulta.resultado === true ? 'clave_valida' : 'clave_incorrecta' })
  }

  const datos: Record<string, unknown> = Object.fromEntries(CAMPOS.map((id) => [id, entrada[id]]))
  const errores: Record<string, string> = {}
  for (const id of CAMPOS) {
    if (id === 'numero_documento' && datos.tipo_documento === 'sin_documento') continue
    const pregunta = PREGUNTA_POR_ID.get(id)
    const error = pregunta ? validarRespuesta(pregunta, datos[id], datos) : 'Campo desconocido.'
    if (error) errores[id] = error
  }
  if (Object.keys(errores).length > 0) {
    return respuesta(422, { error: 'Revisa los datos.', errores })
  }

  // Sin documento no hay nada que buscar en la lista: solo entra con la clave.
  if (datos.tipo_documento === 'sin_documento') return respuesta(200, { resultado: 'no_encontrado' })

  const consulta = await consultar(() =>
    almacen.validarEstudiante(limpiarDocumento(datos.numero_documento), String(datos.fecha_nacimiento)),
  )
  if ('fallo' in consulta) return consulta.fallo
  if (!RESULTADOS.has(consulta.resultado)) {
    console.error('[validar] resultado inesperado', consulta.resultado)
    return NO_DISPONIBLE
  }
  return respuesta(200, { resultado: consulta.resultado })
}
