/**
 * Prueba de carga: envía muchas respuestas válidas en paralelo y mide.
 *
 *   npm run carga -- --clave <clave>                  # local, 600 envíos, 50 a la vez
 *   npm run carga -- --url https://<sitio> --clave <clave> --total 1000 --paralelo 80
 *
 * Las respuestas son de rutas y opciones al azar, con pasaporte PRUEBA...
 * Esos documentos no están en la lista de estudiantes, así que cada envío lleva
 * la clave de la encuesta (sin ella el servidor responde 403). Para borrarlas después:
 *   DELETE FROM respuestas WHERE numero_documento LIKE 'PRUEBA%';
 *
 * Un 5 % de los envíos se repite con el mismo id, como haría un navegador que
 * reintenta: deben responder 200 sin crear otra fila.
 */

import { parseArgs } from 'node:util'

import { INSTRUMENTO } from '../src/lib/encuesta/instrumento'
import type { Opcion } from '../src/lib/encuesta/instrumento'
import { preguntasAplicables } from '../src/lib/encuesta/logica'
import type { Respuestas } from '../src/lib/encuesta/logica'

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://127.0.0.1:3000' },
    total: { type: 'string', default: '600' },
    paralelo: { type: 'string', default: '50' },
    clave: { type: 'string' },
  },
})
if (!values.clave) {
  console.error('Falta --clave: los documentos PRUEBA no están en la lista y solo entran con la clave.')
  process.exit(1)
}
const destino = `${values.url.replace(/\/+$/, '')}/api/respuestas`
const total = Number(values.total)
const paralelo = Number(values.paralelo)

const RUTAS = ['estudiar', 'trabajar', 'estudiar_trabajar', 'indefinido']
const azar = <T>(lista: readonly T[]): T => lista[Math.floor(Math.random() * lista.length)]
const lote = Date.now().toString(36).toUpperCase()

function respuestasAlAzar(i: number): Respuestas {
  const respuestas: Respuestas = {
    tipo_documento: 'pasaporte',
    numero_documento: `PRUEBA${lote}${i}`,
    fecha_nacimiento: `${2006 + (i % 4)}-0${1 + (i % 9)}-1${i % 10}`,
    decision_bachillerato: azar(RUTAS),
  }
  for (const pregunta of preguntasAplicables(respuestas)) {
    if (pregunta.id in respuestas) continue
    const opciones: readonly Opcion[] = pregunta.opciones ?? []
    if (pregunta.tipo === 'unica') {
      respuestas[pregunta.id] = azar(opciones)[0]
    } else if (pregunta.tipo === 'multiple') {
      const marcadas = opciones.filter(() => Math.random() < 0.35).map(([valor]) => valor)
      respuestas[pregunta.id] = marcadas.length > 0 ? marcadas : [opciones[0][0]]
    } else if (pregunta.tipo === 'texto' && Math.random() < 0.5) {
      respuestas[pregunta.id] = 'Respuesta de prueba de carga'
    }
  }
  return respuestas
}

function enviar(cuerpo: unknown) {
  return fetch(destino, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
}

const latencias: number[] = []
const estados: Record<string, number> = {}
const reintentos: Record<string, number> = {}
let siguiente = 0

const contar = (tabla: Record<string, number>, clave: string | number) => {
  tabla[clave] = (tabla[clave] ?? 0) + 1
}

async function trabajador() {
  while (siguiente < total) {
    const i = siguiente++
    const cuerpo = {
      id: crypto.randomUUID(),
      instrumento: INSTRUMENTO.id,
      version: INSTRUMENTO.version,
      consentimientoEn: new Date().toISOString(),
      iniciadaEn: new Date(Date.now() - 480_000).toISOString(),
      respuestas: respuestasAlAzar(i),
      clave: values.clave,
    }
    const inicio = performance.now()
    try {
      const respuesta = await enviar(cuerpo)
      await respuesta.arrayBuffer()
      contar(estados, respuesta.status)
    } catch {
      contar(estados, 'sin conexión')
    }
    latencias.push(performance.now() - inicio)

    if (Math.random() < 0.05) {
      try {
        const repetido = await enviar(cuerpo)
        await repetido.arrayBuffer()
        contar(reintentos, repetido.status)
      } catch {
        contar(reintentos, 'sin conexión')
      }
    }
  }
}

const percentil = (ordenadas: number[], p: number) =>
  ordenadas[Math.min(ordenadas.length - 1, Math.floor(ordenadas.length * p))]

async function principal() {
  console.log(`Enviando ${total} respuestas a ${destino}, ${paralelo} a la vez…`)
  const inicio = performance.now()
  await Promise.all(Array.from({ length: paralelo }, trabajador))
  const segundos = (performance.now() - inicio) / 1000
  const ordenadas = latencias.sort((a, b) => a - b)
  const ms = (valor: number | undefined) => `${Math.round(valor ?? 0)} ms`

  console.log(`
Tiempo total        ${segundos.toFixed(1)} s
Ritmo               ${Math.round((total / segundos) * 60).toLocaleString('es-CO')} respuestas por minuto
Latencia p50 / p95  ${ms(percentil(ordenadas, 0.5))} / ${ms(percentil(ordenadas, 0.95))}
Latencia p99 / máx  ${ms(percentil(ordenadas, 0.99))} / ${ms(ordenadas.at(-1))}
Respuestas HTTP     ${JSON.stringify(estados)}
Reintentos          ${JSON.stringify(reintentos)}  (esperado: todos 200)`)

  const fallidos = total - (estados[201] ?? 0)
  process.exitCode = fallidos > 0 || Object.keys(reintentos).some((e) => e !== '200') ? 1 : 0
}

principal()
