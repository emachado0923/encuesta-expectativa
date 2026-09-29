/**
 * Conexión a MySQL a partir de las variables de entorno (ver .env.example).
 * Next.js las carga de .env; en la máquina virtual pueden venir también del
 * servicio del sistema (systemd), que tiene prioridad sobre el archivo.
 */

export type ConfiguracionMysql = {
  host: string
  port: number
  user: string
  password: string
  database: string
  /** Conexión cifrada (TLS) con la base. */
  ssl: boolean
  /**
   * Ruta del certificado de la autoridad que firma el del servidor (en Google
   * Cloud SQL, server-ca.pem). Con él se verifica que el servidor es el
   * verdadero; implica ssl.
   */
  certificadoCa: string | null
  /** Conexiones abiertas a la vez como máximo. */
  conexiones: number
}

function entero(valor: string | undefined, porDefecto: number): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 ? numero : porDefecto
}

/** null si falta lo mínimo para conectarse: servidor, usuario y base. */
export function leerConfiguracionMysql(
  entorno: Record<string, string | undefined> = process.env,
): ConfiguracionMysql | null {
  const { MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE } = entorno
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_DATABASE) return null
  return {
    host: MYSQL_HOST,
    port: entero(entorno.MYSQL_PORT, 3306),
    user: MYSQL_USER,
    password: entorno.MYSQL_PASSWORD ?? '',
    database: MYSQL_DATABASE,
    ssl: entorno.MYSQL_SSL === 'true' || Boolean(entorno.MYSQL_SSL_CA),
    certificadoCa: entorno.MYSQL_SSL_CA || null,
    conexiones: entero(entorno.MYSQL_CONEXIONES, 10),
  }
}
