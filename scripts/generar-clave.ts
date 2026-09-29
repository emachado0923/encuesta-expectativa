/**
 * Genera la instrucción SQL para poner o cambiar la clave de la encuesta. La
 * clave no queda en ningún archivo: en la base solo se guarda su hash.
 *
 *   npm run clave -- 'una clave larga y difícil de adivinar'
 *
 * Con comillas simples: entre comillas dobles, la terminal cambia los signos
 * ! y $ antes de que la clave llegue aquí, y se cifraría otra clave.
 *
 * Luego se ejecuta la instrucción que imprime en la base de la encuesta.
 */

import { NOMBRE_CLAVE, cifrarClave } from '../src/servidor/clave'

const LARGO_MINIMO = 8

async function principal() {
  const clave = process.argv[2]
  if (!clave) {
    console.error("Uso: npm run clave -- 'la clave nueva'  (con comillas simples)")
    process.exit(1)
  }
  if (clave.trim() !== clave) {
    console.error('La clave no puede empezar ni terminar con espacios: el formulario los quita al comparar.')
    process.exit(1)
  }
  if (clave.length < LARGO_MINIMO || clave.length > 100) {
    console.error(`Usa una clave de ${LARGO_MINIMO} a 100 caracteres.`)
    process.exit(1)
  }

  const hash = await cifrarClave(clave)
  console.log('-- Ejecutar en la base de la encuesta (reemplaza la clave anterior):')
  console.log(`REPLACE INTO claves (nombre, clave_hash) VALUES ('${NOMBRE_CLAVE}', '${hash}');`)
}

principal()
