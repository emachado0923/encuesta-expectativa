/**
 * Envío de las respuestas con reintentos.
 *
 * Con cientos de envíos por minuto y redes de colegio inestables, un fallo
 * pasajero no debe costarle la encuesta a nadie. Se reintenta con espera
 * creciente y aleatoria (para que cien navegadores no reintenten en el mismo
 * segundo) y siempre con el mismo id: el servidor reconoce el reintento y no
 * duplica la respuesta.
 */

const REINTENTABLES = new Set([408, 425, 429, 500, 502, 503, 504])

export class ErrorEnvio extends Error {
  estado: number
  codigo: string | null
  errores: Record<string, string> | null
  reintentable: boolean

  constructor(
    mensaje: string,
    {
      estado = 0,
      codigo = null,
      errores = null,
      reintentable = false,
    }: { estado?: number; codigo?: string | null; errores?: Record<string, string> | null; reintentable?: boolean } = {},
  ) {
    super(mensaje)
    this.name = 'ErrorEnvio'
    this.estado = estado
    this.codigo = codigo
    this.errores = errores
    this.reintentable = reintentable
  }
}

const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

function retardo(intento: number, sugerido: number | null): number {
  if (sugerido) return sugerido * 1000
  const base = Math.min(8000, 1000 * 2 ** (intento - 1))
  return base / 2 + Math.random() * base
}

async function intentar<T>(cuerpo: string, ruta: string, tiempoLimiteMs: number): Promise<T> {
  const control = new AbortController()
  const temporizador = setTimeout(() => control.abort(), tiempoLimiteMs)
  try {
    const respuesta = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      signal: control.signal,
    })
    const datos = await respuesta.json().catch(() => ({}))
    if (respuesta.ok) return datos as T
    throw new ErrorEnvio(datos.error ?? 'El servidor respondió con un error.', {
      estado: respuesta.status,
      codigo: datos.codigo ?? null,
      errores: datos.errores ?? null,
      reintentable: REINTENTABLES.has(respuesta.status),
    })
  } catch (error) {
    if (error instanceof ErrorEnvio) throw error
    throw new ErrorEnvio('No hay conexión con el servidor.', { reintentable: true })
  } finally {
    clearTimeout(temporizador)
  }
}

export async function enviarRespuestas(
  datos: unknown,
  { intentos = 5, alReintentar = () => {} }: { intentos?: number; alReintentar?: (intento: number) => void } = {},
): Promise<{ id: string; codigo: string }> {
  const cuerpo = JSON.stringify(datos)
  for (let intento = 1; ; intento++) {
    try {
      return await intentar(cuerpo, '/api/respuestas', 20000)
    } catch (error) {
      const fallo = error as ErrorEnvio
      if (!fallo.reintentable || intento >= intentos) throw fallo
      alReintentar(intento)
      await pausa(retardo(intento, fallo.estado === 429 ? 5 : null))
    }
  }
}

/**
 * Valida el documento y la fecha, o la clave, antes de las preguntas. Aquí
 * alguien espera frente a la pantalla: un solo reintento si la red falla.
 */
export async function validarDatos(datos: unknown): Promise<{ resultado: string }> {
  const cuerpo = JSON.stringify(datos)
  for (let intento = 1; ; intento++) {
    try {
      return await intentar(cuerpo, '/api/validar', 12000)
    } catch (error) {
      const fallo = error as ErrorEnvio
      if (!fallo.reintentable || intento >= 2) throw fallo
      await pausa(retardo(intento, null))
    }
  }
}

/** Id del envío. crypto.randomUUID solo existe en https o localhost. */
export function nuevoId(): string {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID()
  const bytes = window.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
