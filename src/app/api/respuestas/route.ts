/**
 * POST /api/respuestas: recibe la encuesta completa. La lógica está en
 * src/servidor/enviar.ts.
 */

import { obtenerAlmacen } from '@/servidor/almacen'
import { procesarEnvio } from '@/servidor/enviar'
import { leerJson, responderJson } from '@/servidor/http'

// Una respuesta completa pesa unos 2 KB. Esto deja margen sin aceptar basura.
const LIMITE_BYTES = 32 * 1024

export async function POST(request: Request) {
  const lectura = await leerJson(request, LIMITE_BYTES)
  if ('error' in lectura) return lectura.error

  let almacen
  try {
    almacen = obtenerAlmacen()
  } catch (error) {
    console.error('[respuestas]', (error as Error).message)
    return responderJson(500, { error: 'El servicio no está configurado.' })
  }

  const { estado, cuerpo } = await procesarEnvio(lectura.cuerpo, { almacen })
  return responderJson(estado, cuerpo)
}
