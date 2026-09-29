/** Datos y almacén de prueba, construidos recorriendo el instrumento. */

import { INSTRUMENTO } from '@/lib/encuesta/instrumento'
import { preguntasAplicables } from '@/lib/encuesta/logica'
import type { Respuestas } from '@/lib/encuesta/logica'
import type { Almacen, Fila, ResultadoEnvio } from '@/servidor/almacen'

/** Respuestas válidas para cualquier ruta. Un valor undefined en `extra` quita esa respuesta. */
export function respuestasValidas(ruta = 'estudiar', extra: Record<string, unknown> = {}): Respuestas {
  const respuestas: Respuestas = {
    tipo_documento: 'tarjeta_identidad',
    numero_documento: '1037654321',
    fecha_nacimiento: '2008-05-14',
    decision_bachillerato: ruta,
    ...extra,
  }
  for (const pregunta of preguntasAplicables(respuestas)) {
    if (pregunta.id in respuestas || pregunta.obligatoria === false || !pregunta.opciones) continue
    if (pregunta.tipo === 'unica') respuestas[pregunta.id] = pregunta.opciones[0][0]
    if (pregunta.tipo === 'multiple') respuestas[pregunta.id] = [pregunta.opciones[0][0]]
  }
  for (const [id, valor] of Object.entries(extra)) {
    if (valor === undefined) delete respuestas[id]
  }
  return respuestas
}

export function envioValido(ruta?: string, extra?: Record<string, unknown>, id: string = crypto.randomUUID()) {
  return {
    id,
    instrumento: INSTRUMENTO.id,
    version: INSTRUMENTO.version,
    consentimientoEn: '2026-09-18T15:00:00.000Z',
    iniciadaEn: '2026-09-18T15:00:00.000Z',
    respuestas: respuestasValidas(ruta, extra),
  }
}

/** La clave de la encuesta en las pruebas. */
export const CLAVE_PRUEBA = 'clave-de-prueba'

/**
 * Almacén en memoria con las mismas reglas que MySQL: id único, un número de
 * documento por instrumento (con cualquier tipo), y solo quien está en la
 * lista con su fecha o, si no está, trae la clave. No lleva la cuenta de
 * intentos: eso se prueba contra MySQL (tests/mysql.test.ts).
 * La lista trae por defecto el documento de respuestasValidas.
 */
export function almacenEnMemoria({
  cedulas = [['1037654321', '2008-05-14']] as [string, string][],
  claves = [CLAVE_PRUEBA],
} = {}): Almacen & { filas: Map<string, Fila> } {
  const lista = new Map(cedulas)
  const filas = new Map<string, Fila>()
  const documentos = new Set<string>()
  return {
    filas,
    async insertar(fila, { claveEncuesta = null } = {}): Promise<ResultadoEnvio> {
      const validado =
        fila.numero_documento && lista.has(fila.numero_documento)
          ? lista.get(fila.numero_documento) === fila.fecha_nacimiento
          : claveEncuesta !== null && claves.includes(claveEncuesta)
      if (!validado) return 'no_validado'
      if (filas.has(fila.id)) return 'reintento'
      const numero = fila.numero_documento
      if (numero && documentos.has(numero)) return 'documento_repetido'
      filas.set(fila.id, fila)
      if (numero) documentos.add(numero)
      return 'creada'
    },
    async validarEstudiante(cedula, fecha) {
      if (!lista.has(cedula)) return 'no_encontrado'
      return lista.get(cedula) === fecha ? 'valido' : 'fecha_incorrecta'
    },
    async validarClave(claveEncuesta) {
      return claves.includes(claveEncuesta)
    },
    async salud() {},
  }
}
