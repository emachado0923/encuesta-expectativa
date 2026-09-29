import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { PREGUNTAS } from '@/lib/encuesta/instrumento'
import { RUTAS } from '@/lib/encuesta/logica'

const SQL = readFileSync(new URL('../db/esquema.sql', import.meta.url), 'utf8')

/** Los valores de una restricción CHECK (... IN (...)) del esquema. */
function valoresDe(restriccion: string): string[] {
  const bloque = new RegExp(`CONSTRAINT ${restriccion} CHECK \\(\\w+ IN \\(([^)]+)\\)`).exec(SQL)?.[1]
  if (!bloque) throw new Error(`No encontré la restricción ${restriccion} en db/esquema.sql`)
  return [...bloque.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]).sort()
}

describe('esquema de MySQL', () => {
  it('conoce las mismas rutas que el instrumento', () => {
    expect(valoresDe('respuestas_ruta')).toEqual([...RUTAS].sort())
  })

  it('conoce los mismos tipos de documento que el instrumento', () => {
    const tipos = PREGUNTAS.find((p) => p.id === 'tipo_documento')?.opciones?.map(([valor]) => valor) ?? []
    expect(valoresDe('respuestas_tipo_documento')).toEqual([...tipos].sort())
  })
})
