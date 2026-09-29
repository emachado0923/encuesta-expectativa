/**
 * Dónde se guardan las respuestas y contra qué se valida a quien responde.
 *
 * La lógica de los servicios (validar.ts y enviar.ts) solo conoce esta
 * interfaz: en producción la cumple MySQL (almacen-mysql.ts) y en las pruebas
 * un almacén en memoria. Así las reglas se prueban sin base de datos.
 */

import type { Valor } from '@/lib/encuesta/logica'

import { crearAlmacenMysql } from './almacen-mysql'
import { leerConfiguracionMysql } from './configuracion'

/** Una fila de la tabla `respuestas`. */
export type Fila = {
  id: string
  instrumento: string
  version_instrumento: string
  ruta: string
  tipo_documento: string
  numero_documento: string | null
  fecha_nacimiento: string
  respuestas: Record<string, Valor>
  consentimiento_en: string
  iniciada_en: string | null
  enviada_en: string
  duracion_segundos: number | null
}

export type ResultadoEnvio = 'creada' | 'reintento' | 'documento_repetido' | 'no_validado'
export type ResultadoEstudiante = 'valido' | 'fecha_incorrecta' | 'no_encontrado' | 'bloqueado'

export interface Almacen {
  /**
   * Guarda la fila si quien responde está validado: de la lista con su fecha
   * o, si no está en la lista, con la clave de la encuesta. La clave solo se
   * comprueba: no se guarda.
   */
  insertar(fila: Fila, opciones?: { claveEncuesta?: string | null }): Promise<ResultadoEnvio>
  /** Busca el documento en la lista y compara la fecha de nacimiento. */
  validarEstudiante(cedula: string, fecha: string): Promise<ResultadoEstudiante>
  validarClave(claveEncuesta: string): Promise<boolean>
  /** Falla si no hay conexión con la base. */
  salud(): Promise<void>
}

// Uno por proceso: guarda el pool de conexiones. En desarrollo, Next.js vuelve a
// cargar los módulos con cada cambio; en globalThis el pool sobrevive y no se
// abren conexiones de más.
const proceso = globalThis as typeof globalThis & { __almacenEncuesta?: Almacen }

/** El almacén configurado en las variables de entorno. Falla si falta la configuración de MySQL. */
export function obtenerAlmacen(): Almacen {
  if (!proceso.__almacenEncuesta) {
    const configuracion = leerConfiguracionMysql()
    if (!configuracion) {
      throw new Error('Faltan las variables MYSQL_* (ver .env.example).')
    }
    proceso.__almacenEncuesta = crearAlmacenMysql(configuracion)
  }
  return proceso.__almacenEncuesta
}
