/**
 * GET /api/salud: para revisar el despliegue y para el monitoreo. Responde 200
 * si la aplicación está arriba y llega a la base de datos, y 503 si no. No
 * muestra detalles del error: esos quedan en el registro del servidor.
 */

import { obtenerAlmacen } from '@/servidor/almacen'
import { responderJson } from '@/servidor/http'

// Siempre en el momento: nunca una respuesta guardada del build.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await obtenerAlmacen().salud()
    return responderJson(200, { aplicacion: 'ok', baseDeDatos: 'ok' })
  } catch (error) {
    console.error('[salud] sin conexión con la base de datos:', (error as Error).message)
    return responderJson(503, { aplicacion: 'ok', baseDeDatos: 'sin conexión' })
  }
}
