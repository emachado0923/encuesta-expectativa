/**
 * Lo común a las rutas de la API: leer el cuerpo JSON con un tope de tamaño y
 * responder en JSON sin caché.
 */

export function responderJson(estado: number, cuerpo: unknown): Response {
  return Response.json(cuerpo, { status: estado, headers: { 'Cache-Control': 'no-store' } })
}

/** El cuerpo como texto, o null si pasa del tope. Deja de leer apenas lo pasa. */
async function leerTexto(request: Request, limiteBytes: number): Promise<string | null> {
  if (!request.body) return ''
  const lector = request.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > limiteBytes) {
      await lector.cancel().catch(() => {})
      return null
    }
    partes.push(value)
  }
  return Buffer.concat(partes).toString('utf8')
}

/**
 * El cuerpo como JSON, o una respuesta de error si es muy grande. Un JSON mal
 * formado llega como undefined: los servicios responden 400.
 */
export async function leerJson(
  request: Request,
  limiteBytes: number,
): Promise<{ cuerpo: unknown } | { error: Response }> {
  const demasiado = { error: responderJson(413, { error: 'La solicitud es demasiado grande.' }) }
  if (Number(request.headers.get('content-length') ?? 0) > limiteBytes) return demasiado

  const texto = await leerTexto(request, limiteBytes)
  if (texto === null) return demasiado
  try {
    return { cuerpo: JSON.parse(texto) }
  } catch {
    return { cuerpo: undefined }
  }
}
