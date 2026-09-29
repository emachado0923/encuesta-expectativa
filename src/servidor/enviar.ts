/**
 * Recepción de un envío. No depende de Next.js ni de MySQL: recibe el cuerpo ya
 * leído y un almacén, y devuelve el estado HTTP y el cuerpo de la respuesta.
 *
 * El id del envío lo genera el navegador al empezar. Eso hace que los
 * reintentos sean seguros: si la red corta después de guardar y el navegador
 * vuelve a enviar, el almacén reconoce el id y no se duplica la respuesta.
 */

import { INSTRUMENTO } from '@/lib/encuesta/instrumento'
import { PREGUNTA_RUTA, validarEnvio } from '@/lib/encuesta/logica'

import type { Almacen, Fila, ResultadoEnvio } from './almacen'
import { limpiarClave, type Respuesta } from './validar'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Código corto para mostrar al final: los 8 primeros caracteres del id. */
export function codigoRegistro(id: string): string {
  const base = id.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `${base.slice(0, 4)}-${base.slice(4)}`
}

function fechaIso(valor: unknown): Date | null {
  if (typeof valor !== 'string' || valor.length > 40) return null
  const fecha = new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

const respuesta = (estado: number, cuerpo: Record<string, unknown>): Respuesta => ({ estado, cuerpo })

export async function procesarEnvio(
  cuerpo: unknown,
  { almacen, ahora = () => new Date() }: { almacen: Pick<Almacen, 'insertar'>; ahora?: () => Date },
): Promise<Respuesta> {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return respuesta(400, { error: 'El envío no tiene el formato esperado.' })
  }

  const { id, instrumento, version, consentimientoEn, iniciadaEn, respuestas, clave } = cuerpo as Record<
    string,
    unknown
  >

  if (typeof id !== 'string' || !UUID.test(id)) {
    return respuesta(400, { error: 'Falta el identificador del envío.' })
  }
  if (instrumento !== INSTRUMENTO.id) {
    return respuesta(400, { error: 'El envío corresponde a otro formulario.' })
  }
  if (version !== INSTRUMENTO.version) {
    return respuesta(409, {
      codigo: 'version',
      error: 'El formulario se actualizó mientras respondías. Recarga la página: tus respuestas se conservan.',
    })
  }

  const consentimiento = fechaIso(consentimientoEn)
  if (!consentimiento) {
    return respuesta(400, { error: 'Falta la autorización de tratamiento de datos.' })
  }

  const { limpias, errores } = validarEnvio(respuestas)
  if (Object.keys(errores).length > 0) {
    return respuesta(422, { error: 'Hay respuestas que no son válidas.', errores })
  }

  const enviadaEn = ahora()
  const iniciada = fechaIso(iniciadaEn)
  const duracion = iniciada ? Math.round((enviadaEn.getTime() - iniciada.getTime()) / 1000) : null
  const numero = limpias.numero_documento

  const fila: Fila = {
    id: id.toLowerCase(),
    instrumento: INSTRUMENTO.id,
    version_instrumento: INSTRUMENTO.version,
    ruta: String(limpias[PREGUNTA_RUTA]),
    tipo_documento: String(limpias.tipo_documento),
    numero_documento: typeof numero === 'string' ? numero : null,
    fecha_nacimiento: String(limpias.fecha_nacimiento),
    respuestas: limpias,
    consentimiento_en: consentimiento.toISOString(),
    iniciada_en: iniciada ? iniciada.toISOString() : null,
    enviada_en: enviadaEn.toISOString(),
    // El reloj del navegador puede estar mal: una duración negativa no se guarda.
    duracion_segundos: duracion !== null && duracion >= 0 ? duracion : null,
  }

  // Quien no está en la lista de estudiantes responde con la clave de la
  // encuesta. Va aparte de la fila: sirve para validar y no se guarda.
  const claveEncuesta = limpiarClave(clave)

  let resultado: ResultadoEnvio
  try {
    resultado = await almacen.insertar(fila, { claveEncuesta })
  } catch (error) {
    console.error('[respuestas] no se pudo guardar', error)
    return respuesta(503, {
      error: 'No pudimos guardar tus respuestas en este momento. Vuelve a intentarlo.',
    })
  }

  if (resultado === 'no_validado') {
    return respuesta(403, {
      codigo: 'no_validado',
      error: 'No pudimos validar tu documento y tu fecha de nacimiento, ni una clave de la encuesta.',
    })
  }

  if (resultado === 'documento_repetido') {
    return respuesta(409, {
      codigo: 'documento_repetido',
      error: 'Ya hay una respuesta registrada con este documento.',
    })
  }

  // 'creada' o 'reintento': para quien responde es lo mismo, quedó guardado.
  return respuesta(resultado === 'creada' ? 201 : 200, {
    id: fila.id,
    codigo: codigoRegistro(fila.id),
  })
}
