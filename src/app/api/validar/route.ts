/**
 * POST /api/validar: valida a quien responde antes de las preguntas (documento
 * y fecha, o la clave). La lógica está en src/servidor/validar.ts.
 */

import { obtenerAlmacen } from '@/servidor/almacen'
import { leerJson, responderJson } from '@/servidor/http'
import { procesarValidacion } from '@/servidor/validar'

// Un documento, una fecha o una clave: cabe de sobra.
const LIMITE_BYTES = 2 * 1024

export async function POST(request: Request) {
  const lectura = await leerJson(request, LIMITE_BYTES)
  if ('error' in lectura) return lectura.error

  let almacen
  try {
    almacen = obtenerAlmacen()
  } catch (error) {
    console.error('[validar]', (error as Error).message)
    return responderJson(500, { error: 'El servicio no está configurado.' })
  }

  const { estado, cuerpo } = await procesarValidacion(lectura.cuerpo, { almacen })
  return responderJson(estado, cuerpo)
}
