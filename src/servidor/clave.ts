/**
 * La clave de la encuesta se guarda cifrada, nunca en texto plano: la tabla
 * `claves` guarda un hash scrypt con su sal. Quien tenga acceso a la base, o a
 * una copia de ella, no puede leer la clave.
 *
 * Formato: scrypt$N$r$p$sal$hash (sal y hash en base64).
 * Para generar el hash de una clave nueva: npm run clave -- 'la clave'.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/** La fila de la tabla `claves` que usa esta encuesta. */
export const NOMBRE_CLAVE = 'encuesta_expectativas_2026'

// Parámetros recomendados para scrypt: unos 16 MB de memoria por comprobación.
const COSTO = { N: 16384, r: 8, p: 1 }
const LARGO_HASH = 32

function derivar(clave: string, sal: Buffer, costo: typeof COSTO, largo: number): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(clave, sal, largo, { ...costo, maxmem: 64 * 1024 * 1024 }, (error, hash) =>
      error ? rechazar(error) : resolver(hash),
    )
  })
}

export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16)
  const hash = await derivar(clave, sal, COSTO, LARGO_HASH)
  return ['scrypt', COSTO.N, COSTO.r, COSTO.p, sal.toString('base64'), hash.toString('base64')].join('$')
}

/** Compara en tiempo constante. Un hash con otro formato nunca coincide. */
export async function claveCoincide(clave: string, guardada: string): Promise<boolean> {
  const partes = guardada.split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false
  const [, N, r, p, sal, hash] = partes
  const costo = { N: Number(N), r: Number(r), p: Number(p) }
  if (!Object.values(costo).every((n) => Number.isInteger(n) && n > 0)) return false
  const esperado = Buffer.from(hash, 'base64')
  if (esperado.length === 0) return false
  try {
    const obtenido = await derivar(clave, Buffer.from(sal, 'base64'), costo, esperado.length)
    return timingSafeEqual(obtenido, esperado)
  } catch {
    return false
  }
}
