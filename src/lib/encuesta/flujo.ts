/**
 * El recorrido de la encuesta como funciones puras: cada acción recibe el
 * estado y devuelve el siguiente, sin tocar la página ni la red. Así se prueba
 * sin navegador (tests/flujo.test.ts) y los componentes solo dibujan el estado.
 *
 * Lo que hay que hacer en la página después de dibujar (enfocar un campo,
 * desplazar) va en `pedido`; lo aplica el hook useEncuesta.
 */

import { INSTRUMENTO, PREGUNTAS } from './instrumento'
import type { Pregunta } from './instrumento'
import {
  PASO_VALIDACION,
  PREGUNTA_RUTA,
  calcularAvance,
  edadDe,
  estaCompleta,
  estaRespondida,
  formatoDocumento,
  limpiarDocumento,
  pasosAplicables,
  preguntasAplicables,
  rutaDefinida,
  validarEnvio,
  validarRespuesta,
} from './logica'
import type { Respuestas } from './logica'

export type Vista = 'bienvenida' | 'politicas' | 'encuesta' | 'final'
export type Direccion = 'adelante' | 'atras'

/** Cómo pasó la validación quien responde. La clave vale para el número con que se usó. */
export type Validacion =
  | { via: 'lista'; numero: string; fecha: string }
  | { via: 'clave'; clave: string; numero: string | null }

export type AccionMensaje = 'revisar-documento' | 'recargar' | 'reintentar'

export type Mensaje = {
  tipo: 'error' | 'espera' | 'listo'
  titulo: string
  texto?: string
  acciones?: AccionMensaje[]
}

/** Lo que hay que hacer en la página después de dibujar. `n` cambia con cada pedido. */
export type Pedido = {
  n: number
  /** id del elemento que recibe el foco. */
  foco?: string
  /** Enfocar el primer campo de la tarjeta de la pregunta. */
  primerCampo?: boolean
  /** Enfocar sin desplazar la página. */
  sinDesplazar?: boolean
  /** Si la tarjeta quedó arriba de la pantalla, subir hasta ella. */
  alinearTarjeta?: boolean
  /** Volver al principio de la página. */
  alInicio?: boolean
}

export type Estado = {
  vista: Vista
  respuestas: Respuestas
  omitidas: readonly string[]
  actual: string | null
  consentimientoEn: string | null
  iniciadaEn: string | null
  idEnvio: string | null
  codigo: string | null
  errores: Record<string, string>
  intentoEnvio: boolean
  enviando: boolean
  validando: boolean
  validacion: Validacion | null
  /** La lista no tiene el documento: se pide la clave. */
  pedirClave: boolean
  claveEscrita: string
  /** Si hubo que validar otra vez a mitad de la encuesta, la pregunta a la que se vuelve. */
  volverA: string | null
  mensaje: Mensaje | null
  /** Cada navegación vuelve a montar la tarjeta, que entra animada desde ese lado. */
  navegacion: { n: number; direccion: Direccion | null }
  pedido: Pedido | null
}

/** Lo que se guarda en sessionStorage para retomar tras recargar. */
export type Borrador = {
  vista: Vista
  respuestas?: Respuestas
  omitidas?: string[]
  actual?: string | null
  consentimientoEn?: string | null
  iniciadaEn?: string | null
  idEnvio?: string | null
  codigo?: string | null
  validacion?: Validacion | null
  volverA?: string | null
}

/** El número de documento se escribe en el paso de validación, junto con la fecha. */
export const PREGUNTA_NUMERO = 'numero_documento'
const CAMPOS_VALIDACION = [PREGUNTA_NUMERO, PASO_VALIDACION, 'clave']
const SECCION_INICIAL = PREGUNTAS[0].seccion

const PREGUNTA_POR_ID = new Map<string, Pregunta>()
const ORDEN = new Map<string, number>()
PREGUNTAS.forEach((pregunta, i) => {
  if (!PREGUNTA_POR_ID.has(pregunta.id)) PREGUNTA_POR_ID.set(pregunta.id, pregunta)
  if (!ORDEN.has(pregunta.id)) ORDEN.set(pregunta.id, i)
})

export function preguntaPorId(id: string): Pregunta {
  const pregunta = PREGUNTA_POR_ID.get(id)
  if (!pregunta) throw new Error(`No existe la pregunta ${id}`)
  return pregunta
}

export const estadoInicial = (): Estado => ({
  vista: 'bienvenida',
  respuestas: {},
  omitidas: [],
  actual: null,
  consentimientoEn: null,
  iniciadaEn: null,
  idEnvio: null,
  codigo: null,
  errores: {},
  intentoEnvio: false,
  enviando: false,
  validando: false,
  validacion: null,
  pedirClave: false,
  claveEscrita: '',
  volverA: null,
  mensaje: null,
  navegacion: { n: 0, direccion: null },
  pedido: null,
})

// ── Lo que se deriva del estado ──────────────────────────────────────────

/** Los pasos que se ven (el número de documento va dentro de la validación). */
export const pasos = (e: Estado) => pasosAplicables(e.respuestas)

export function numeroDe(e: Estado, id: string | null): number {
  return pasos(e).findIndex((pregunta) => pregunta.id === id) + 1
}

export function despuesDeValidacion(id: string | null): boolean {
  if (id === null) return false
  return (ORDEN.get(id) ?? -1) > (ORDEN.get(PASO_VALIDACION) ?? -1)
}

/** La pregunta en pantalla. Si dejó de aplicar (cambió la ruta), la siguiente que sí aplica. */
export function preguntaActual(e: Estado): Pregunta {
  const lista = pasos(e)
  const encontrada = lista.find((p) => p.id === e.actual)
  if (encontrada) return encontrada
  const orden = e.actual === null ? -1 : (ORDEN.get(e.actual) ?? -1)
  return lista.find((p) => (ORDEN.get(p.id) ?? -1) > orden) ?? lista[lista.length - 1]
}

export const tieneDocumento = (e: Estado) => e.respuestas.tipo_documento !== 'sin_documento'

/** El número tal como se valida; null para quien no tiene documento. */
export function numeroActual(e: Estado): string | null {
  return formatoDocumento(e.respuestas) ? limpiarDocumento(e.respuestas[PREGUNTA_NUMERO]) : null
}

/**
 * Quien responde ya pasó la validación con los datos que tiene ahora. La clave
 * vale para el número con que se usó: con otro número hay que volver a buscarlo
 * en la lista, porque quien está en la lista solo entra con su fecha.
 */
export function validacionVigente(e: Estado): boolean {
  const validacion = e.validacion
  if (validacion?.via === 'clave') return validacion.numero === numeroActual(e)
  if (validacion?.via !== 'lista' || !numeroActual(e)) return false
  return validacion.numero === numeroActual(e) && validacion.fecha === e.respuestas[PASO_VALIDACION]
}

export function textosValidacion(e: Estado): { texto: string; ayuda: string } {
  return tieneDocumento(e)
    ? {
        texto: 'Tu documento y tu fecha de nacimiento',
        ayuda: 'Con estos datos confirmamos que estás en la lista de estudiantes que pueden responder.',
      }
    : {
        texto: 'Tu fecha de nacimiento',
        ayuda: 'Como no tienes documento, para seguir necesitas la clave de la encuesta.',
      }
}

/** Un solo aviso para el paso de validación: el del primer campo con problema. Sin documento no hay número. */
export function errorValidacion(e: Estado): string | undefined {
  const errorNumero = tieneDocumento(e) ? e.errores[PREGUNTA_NUMERO] : undefined
  return errorNumero ?? e.errores[PASO_VALIDACION] ?? e.errores.clave
}

/** La edad que resulta de la fecha: el segundo elemento de verificación. */
export function textoEdad(e: Estado, hoy: Date = new Date()): string {
  const fecha = e.respuestas[PASO_VALIDACION]
  if (typeof fecha !== 'string' || validarRespuesta(preguntaPorId(PASO_VALIDACION), fecha, e.respuestas)) return ''
  const edad = edadDe(fecha, hoy)
  return `Tienes ${edad} ${edad === 1 ? 'año' : 'años'}.`
}

/** "Pregunta 6 de 18"; sin total mientras no se sabe la ruta. */
export function textoNumero(e: Estado, pregunta: Pregunta): string {
  const numero = numeroDe(e, pregunta.id)
  return rutaDefinida(e.respuestas) ? `Pregunta ${numero} de ${pasos(e).length}` : `Pregunta ${numero}`
}

/** En "Sobre ti" solo se ven sus círculos y no el porcentaje: lo que sigue depende de la validación y del camino. */
export const enInicio = (e: Estado) => preguntaActual(e).seccion === SECCION_INICIAL

export type EstadoNumero = 'completa' | 'omitida' | 'falta' | 'pendiente'

export function estadoNumero(e: Estado, pregunta: Pregunta): EstadoNumero {
  // La validación cuenta como respondida cuando se pasó, no al escribir la fecha.
  if (pregunta.id === PASO_VALIDACION) {
    if (validacionVigente(e)) return 'completa'
    return errorValidacion(e) || e.intentoEnvio ? 'falta' : 'pendiente'
  }
  const omitidas = new Set(e.omitidas)
  if (!estaRespondida(e.respuestas[pregunta.id]) && omitidas.has(pregunta.id)) return 'omitida'
  if (estaCompleta(pregunta, e.respuestas, omitidas)) return 'completa'
  if (e.errores[pregunta.id]) return 'falta'
  // Tras intentar enviar, en rojo solo lo que impide enviar: una opcional vacía no.
  const impide = validarRespuesta(pregunta, e.respuestas[pregunta.id], e.respuestas)
  if (e.intentoEnvio && impide) return 'falta'
  return 'pendiente'
}

export function avance(e: Estado) {
  // Sin validar, la fecha escrita todavía no cuenta como respondida.
  const respuestas = validacionVigente(e) ? e.respuestas : { ...e.respuestas, [PASO_VALIDACION]: undefined }
  const { completas, total, porcentaje } = calcularAvance(respuestas, new Set(e.omitidas))
  const definida = rutaDefinida(e.respuestas)
  // Antes de elegir camino el total es una estimación: no se muestra como cifra.
  const palabra = completas === 1 && !definida ? 'respondida' : 'respondidas'
  return {
    completas,
    total,
    porcentaje,
    definida,
    conteo: definida ? `${completas} de ${total} ${palabra}` : `${completas} ${palabra}`,
    textoAccesible: definida ? `${completas} de ${total} preguntas respondidas` : `${completas} preguntas respondidas`,
  }
}

/** Categoría de color de los círculos: Sobre ti, Tu decisión y Tu camino (las rutas). */
const CATEGORIA_POR_SECCION: Record<string, string> = { caracterizacion: 'sobre-ti', corte_inicial: 'decision' }

export type Circulo = {
  id: string
  numero: number
  seccion: string
  categoria: string
  estado: EstadoNumero
  titulo: string
  /** Separación antes del círculo: empieza otra sección. */
  corte: boolean
}

/** Los círculos para saltar entre preguntas y, si falta elegir camino, el aviso de lo que sigue. */
export function circulos(e: Estado): { lista: Circulo[]; aviso: string | null } {
  const inicio = enInicio(e)
  const lista = inicio ? pasos(e).filter((p) => p.seccion === SECCION_INICIAL) : pasos(e)
  const resultado = lista.map((pregunta, i): Circulo => ({
    id: pregunta.id,
    numero: i + 1,
    seccion: pregunta.seccion,
    categoria: CATEGORIA_POR_SECCION[pregunta.seccion] ?? 'camino',
    estado: estadoNumero(e, pregunta),
    titulo: pregunta.id === PASO_VALIDACION ? textosValidacion(e).texto : pregunta.texto,
    corte: i > 0 && lista[i - 1].seccion !== pregunta.seccion,
  }))
  const aviso =
    !rutaDefinida(e.respuestas) && !inicio
      ? `Las siguientes preguntas dependen de tu respuesta a la pregunta ${numeroDe(e, PREGUNTA_RUTA)}.`
      : null
  return { lista: resultado, aviso }
}

/** El botón principal: en el último paso, con camino elegido, envía. */
export function esUltimoPaso(e: Estado): boolean {
  const lista = pasos(e)
  return rutaDefinida(e.respuestas) && lista.findIndex((p) => p.id === e.actual) === lista.length - 1
}

export function esPrimerPaso(e: Estado): boolean {
  return pasos(e).findIndex((p) => p.id === e.actual) <= 0
}

function listaNumeros(numeros: number[]): string {
  if (numeros.length === 1) return String(numeros[0])
  return `${numeros.slice(0, -1).join(', ')} y ${numeros[numeros.length - 1]}`
}

// ── Acciones ─────────────────────────────────────────────────────────────

function pedir(e: Estado, pedido: Omit<Pedido, 'n'>): Pedido {
  return { ...pedido, n: (e.pedido?.n ?? 0) + 1 }
}

function sinErroresValidacion(errores: Record<string, string>): Record<string, string> {
  if (!CAMPOS_VALIDACION.some((id) => id in errores)) return errores
  const restantes = { ...errores }
  for (const id of CAMPOS_VALIDACION) delete restantes[id]
  return restantes
}

export function cambiarVista(e: Estado, vista: Vista): Estado {
  const foco = vista === 'encuesta' ? `texto-${preguntaActual(e).id}` : 'titulo-vista'
  return { ...e, vista, pedido: pedir(e, { foco, sinDesplazar: true, alInicio: true }) }
}

/** "Aceptar y continuar" en el aviso de datos. */
export function comenzar(e: Estado, ahora: string, idEnvio: string): Estado {
  return cambiarVista(
    {
      ...e,
      consentimientoEn: e.consentimientoEn ?? ahora,
      iniciadaEn: e.iniciadaEn ?? ahora,
      idEnvio: e.idEnvio ?? idEnvio,
      actual: e.actual ?? pasosAplicables(e.respuestas)[0].id,
    },
    'encuesta',
  )
}

export function responder(e: Estado, preguntaId: string, valor: unknown): Estado {
  const respuestas = { ...e.respuestas }
  let omitidas = e.omitidas
  if (estaRespondida(valor)) {
    respuestas[preguntaId] = valor
    omitidas = omitidas.filter((id) => id !== preguntaId)
  } else {
    delete respuestas[preguntaId]
  }

  let errores = e.errores
  if (errores[preguntaId]) {
    errores = { ...errores }
    delete errores[preguntaId]
  }

  let pedirClave = e.pedirClave
  // Con otro documento u otra fecha hay que volver a buscar en la lista.
  if (preguntaId === PREGUNTA_NUMERO || preguntaId === PASO_VALIDACION) {
    errores = sinErroresValidacion(errores)
    if (pedirClave && respuestas.tipo_documento !== 'sin_documento') pedirClave = false
  }
  // Con otro tipo de documento la validación empieza de cero: los avisos del
  // documento anterior ya no aplican (por ejemplo, el del número si pasa a "Sin Documento").
  if (preguntaId === 'tipo_documento') {
    errores = sinErroresValidacion(errores)
    pedirClave = false
  }
  return { ...e, respuestas, omitidas, errores, pedirClave }
}

export function escribirClave(e: Estado, texto: string): Estado {
  return { ...e, claveEscrita: texto, errores: sinErroresValidacion(e.errores) }
}

export function ocultarMensaje(e: Estado): Estado {
  return e.mensaje ? { ...e, mensaje: null } : e
}

export function mostrarMensaje(e: Estado, mensaje: Mensaje): Estado {
  return { ...e, mensaje }
}

export function irA(e: Estado, id: string, direccion?: Direccion): Estado {
  // Nada de lo que sigue a la validación se abre sin haberla pasado.
  const destino = despuesDeValidacion(id) && !validacionVigente(e) ? PASO_VALIDACION : id
  const hacia = direccion ?? (numeroDe(e, destino) >= numeroDe(e, e.actual) ? 'adelante' : 'atras')
  return {
    ...e,
    actual: destino,
    pedirClave: false,
    navegacion: { n: e.navegacion.n + 1, direccion: hacia },
    pedido: pedir(e, { foco: `texto-${destino}`, sinDesplazar: true, alinearTarjeta: true }),
  }
}

/** Un círculo de la fila de números. */
export function saltarA(e: Estado, id: string): Estado {
  if (id === e.actual) return e
  return irA(ocultarMensaje(e), id)
}

export function anterior(e: Estado): Estado {
  const lista = pasos(e)
  const indice = lista.indexOf(preguntaActual(e))
  if (indice <= 0) return e
  return irA(ocultarMensaje(e), lista[indice - 1].id, 'atras')
}

export function marcarErrorPregunta(e: Estado, preguntaId: string, texto: string): Estado {
  return { ...e, errores: { ...e.errores, [preguntaId]: texto }, pedido: pedir(e, { primerCampo: true }) }
}

export function marcarErrorValidacion(e: Estado, campo: string, texto: string): Estado {
  return { ...e, errores: { ...e.errores, [campo]: texto }, pedido: pedir(e, { foco: campo }) }
}

export type Paso = { estado: Estado; enviar: boolean }

/** Pasa al paso siguiente o, en el último, pide enviar. */
export function avanzar(e: Estado, pregunta: Pregunta): Paso {
  let s = ocultarMensaje(e)
  if (!estaRespondida(s.respuestas[pregunta.id]) && pregunta.obligatoria === false && !s.omitidas.includes(pregunta.id)) {
    s = { ...s, omitidas: [...s.omitidas, pregunta.id] }
  }

  const lista = pasos(s)
  const indice = lista.indexOf(pregunta)
  if (indice < lista.length - 1) return { estado: irA(s, lista[indice + 1].id, 'adelante'), enviar: false }

  // Llegó al final sin elegir camino (saltando con los números): falta el corte.
  if (!rutaDefinida(s.respuestas)) {
    const texto = validarRespuesta(preguntaPorId(PREGUNTA_RUTA), undefined, {}) ?? ''
    return { estado: irA({ ...s, errores: { ...s.errores, [PREGUNTA_RUTA]: texto } }, PREGUNTA_RUTA, 'atras'), enviar: false }
  }
  return { estado: s, enviar: true }
}

/** "Siguiente" en una pregunta que no es la de validación. */
export function siguiente(e: Estado): Paso {
  const pregunta = preguntaActual(e)
  const error = validarRespuesta(pregunta, e.respuestas[pregunta.id], e.respuestas)
  if (error) return { estado: marcarErrorPregunta(e, pregunta.id, error), enviar: false }
  return avanzar(e, pregunta)
}

/**
 * Validación pasada: al paso siguiente. Si tuvo que validar otra vez a mitad
 * de la encuesta (al enviar o al recargar), de vuelta a la pregunta en la que iba.
 */
export function trasValidar(e: Estado, pregunta: Pregunta): Paso {
  const destino = e.volverA
  const s: Estado = { ...e, volverA: null }
  const aplica = destino !== null && despuesDeValidacion(destino) && pasos(s).some((p) => p.id === destino)
  if (!aplica) return avanzar(s, pregunta)
  const t = irA(s, destino, 'adelante')
  const lista = pasos(t)
  const ultima = rutaDefinida(t.respuestas) && destino === lista[lista.length - 1].id
  return {
    estado: mostrarMensaje(t, {
      tipo: 'listo',
      titulo: 'Listo, ya validamos tus datos',
      texto: ultima ? 'Ya puedes enviar tus respuestas.' : 'Sigue desde la pregunta en la que ibas.',
    }),
    enviar: false,
  }
}

// ── Validación de quién responde ─────────────────────────────────────────

export type DatosValidacion =
  | { clave: string }
  | { tipo_documento: unknown; numero_documento: string; fecha_nacimiento: unknown }

export type Consulta = { datos: DatosValidacion; conClave: boolean; numero: string | null; foto: string }

/** Todo lo que decide la validación, tal como está en este momento. */
function fotoValidacion(e: Estado, conClave: boolean): string {
  return JSON.stringify([
    e.respuestas.tipo_documento,
    numeroActual(e),
    e.respuestas[PASO_VALIDACION],
    conClave ? e.claveEscrita.trim() : null,
  ])
}

/**
 * "Siguiente" en el paso de validación, antes de consultar: revisa los campos.
 * Devuelve el paso ya resuelto (un error, o la validación que sigue vigente) o
 * la consulta que hay que hacer (la lista o la clave).
 */
export function prepararValidacion(e: Estado): ({ tipo: 'resuelto' } & Paso) | ({ tipo: 'consultar' } & Consulta) {
  const pregunta = preguntaActual(e)
  const campos = tieneDocumento(e) ? [PREGUNTA_NUMERO, PASO_VALIDACION] : [PASO_VALIDACION]
  for (const id of campos) {
    const error = validarRespuesta(preguntaPorId(id), e.respuestas[id], e.respuestas)
    if (error) return { tipo: 'resuelto', estado: marcarErrorValidacion(e, id, error), enviar: false }
  }
  if (validacionVigente(e)) return { tipo: 'resuelto', ...trasValidar(e, pregunta) }

  const conClave = e.pedirClave || !tieneDocumento(e)
  if (conClave && !e.claveEscrita.trim()) {
    return {
      tipo: 'resuelto',
      estado: marcarErrorValidacion(e, 'clave', 'Escribe la clave de la encuesta para seguir.'),
      enviar: false,
    }
  }
  const datos: DatosValidacion = conClave
    ? { clave: e.claveEscrita.trim() }
    : {
        tipo_documento: e.respuestas.tipo_documento,
        numero_documento: limpiarDocumento(e.respuestas[PREGUNTA_NUMERO]),
        fecha_nacimiento: e.respuestas[PASO_VALIDACION],
      }
  // La clave queda ligada al número con que se pidió, no al que haya al terminar.
  return { tipo: 'consultar', datos, conClave, numero: numeroActual(e), foto: fotoValidacion(e, conClave) }
}

/** La respuesta del servidor a la validación. */
export function aplicarValidacion(
  e: Estado,
  consulta: Consulta,
  resultado: string,
  errores: Record<string, string> | null,
): Paso {
  const s: Estado = { ...e, validando: false }
  // Si mientras tanto cambió de pregunta o cambió el tipo, el número, la fecha
  // o la clave, esta respuesta ya no aplica: hay que oprimir "Siguiente" otra vez.
  if (preguntaActual(s).id !== PASO_VALIDACION || fotoValidacion(s, consulta.conClave) !== consulta.foto) {
    return { estado: s, enviar: false }
  }
  const pregunta = preguntaActual(s)
  const { datos } = consulta
  const resuelto = (estado: Estado): Paso => ({ estado, enviar: false })

  switch (resultado) {
    case 'valido':
      if ('clave' in datos) break
      return trasValidar(
        { ...s, validacion: { via: 'lista', numero: datos.numero_documento, fecha: String(datos.fecha_nacimiento) } },
        pregunta,
      )
    case 'clave_valida':
      if (!('clave' in datos)) break
      return trasValidar({ ...s, validacion: { via: 'clave', clave: datos.clave, numero: consulta.numero } }, pregunta)
    case 'no_encontrado':
      // Sin avisos anteriores: al enfocar la clave, el lector lee solo por qué se pide.
      return resuelto({ ...s, errores: sinErroresValidacion(s.errores), pedirClave: true, pedido: pedir(s, { foco: 'clave' }) })
    case 'fecha_incorrecta':
      return resuelto(
        marcarErrorValidacion(s, PASO_VALIDACION, 'La fecha de nacimiento no coincide con la que tenemos para ese documento. Revísala.'),
      )
    case 'bloqueado':
      return resuelto(
        marcarErrorValidacion(s, PASO_VALIDACION, 'Hubo varios intentos con este documento. Espera unos 15 minutos y vuelve a intentarlo.'),
      )
    case 'clave_incorrecta':
      return resuelto(marcarErrorValidacion(s, 'clave', 'La clave no es correcta. Revísala.'))
  }
  const [campoConError, texto] = Object.entries(errores ?? {})[0] ?? []
  if (campoConError) return resuelto(marcarErrorValidacion(s, campoConError, texto))
  return resuelto(
    marcarErrorValidacion(
      s,
      consulta.conClave ? 'clave' : PASO_VALIDACION,
      'No pudimos validar tus datos. Revisa tu conexión e inténtalo de nuevo.',
    ),
  )
}

// ── Envío ────────────────────────────────────────────────────────────────

export function marcarFaltantes(e: Estado, errores: Record<string, string>, titulo?: string): { estado: Estado; hubo: boolean } {
  const s: Estado = { ...e, intentoEnvio: true, errores: { ...errores } }
  // Un error en el número de documento se corrige en el paso de validación.
  const faltantes = pasos(s).filter(
    (pregunta) => errores[pregunta.id] || (pregunta.id === PASO_VALIDACION && errores[PREGUNTA_NUMERO]),
  )
  if (faltantes.length === 0) return { estado: s, hubo: false }
  const numeros = faltantes.map((pregunta) => numeroDe(s, pregunta.id))
  const t = irA(s, faltantes[0].id)
  return {
    estado: mostrarMensaje(t, {
      tipo: 'error',
      titulo: titulo ?? (faltantes.length === 1 ? 'Te falta 1 pregunta' : `Te faltan ${faltantes.length} preguntas`),
      texto: `Revisa ${faltantes.length === 1 ? 'la pregunta' : 'las preguntas'} ${listaNumeros(numeros)}: están marcadas en rojo en la fila de números.`,
    }),
    hubo: true,
  }
}

export type CuerpoEnvio = {
  id: string | null
  instrumento: string
  version: string
  consentimientoEn: string | null
  iniciadaEn: string | null
  respuestas: Respuestas
  clave?: string
}

/** Antes de enviar: lo que falta, o el cuerpo que se envía. */
export function prepararEnvio(e: Estado): { tipo: 'faltan'; estado: Estado } | { tipo: 'enviar'; estado: Estado; cuerpo: CuerpoEnvio } {
  let s = e
  const { errores } = validarEnvio(s.respuestas)
  if (Object.keys(errores).length > 0) {
    const marcado = marcarFaltantes(s, errores)
    if (marcado.hubo) return { tipo: 'faltan', estado: marcado.estado }
    s = marcado.estado
  }
  // Solo lo que aplica a la ruta final: si cambió de camino, lo de la ruta anterior no viaja.
  const respuestas = Object.fromEntries(
    preguntasAplicables(s.respuestas)
      .filter((pregunta) => estaRespondida(s.respuestas[pregunta.id]))
      .map((pregunta) => [pregunta.id, s.respuestas[pregunta.id]]),
  )
  return {
    tipo: 'enviar',
    estado: { ...s, enviando: true },
    cuerpo: {
      id: s.idEnvio,
      instrumento: INSTRUMENTO.id,
      version: INSTRUMENTO.version,
      consentimientoEn: s.consentimientoEn,
      iniciadaEn: s.iniciadaEn,
      respuestas,
      // Quien no está en la lista envía la clave: el servidor la vuelve a comprobar y no la guarda.
      clave: s.validacion?.via === 'clave' ? s.validacion.clave : undefined,
    },
  }
}

export function envioExitoso(e: Estado, codigo: string): Estado {
  return cambiarVista({ ...e, enviando: false, codigo, mensaje: null }, 'final')
}

export type ErrorDeEnvio = { estado?: number; codigo?: string | null; errores?: Record<string, string> | null }

export function envioFallido(e: Estado, error: ErrorDeEnvio): Estado {
  let s: Estado = { ...e, enviando: false }

  if (error.estado === 422 && error.errores) {
    const marcado = marcarFaltantes(s, error.errores, 'Hay respuestas por revisar')
    if (marcado.hubo) return marcado.estado
    s = marcado.estado
  }

  if (error.codigo === 'no_validado') {
    // Por ejemplo, cambió la clave mientras respondía: se vuelve a validar sin
    // perder nada y después se regresa aquí. Quien entró con la clave la ve
    // enseguida, vacía, para escribir la nueva.
    const conClave = s.validacion?.via === 'clave' || !tieneDocumento(s)
    const actual = preguntaActual(s).id
    let t = irA({ ...s, validacion: null, volverA: despuesDeValidacion(actual) ? actual : null, claveEscrita: '' }, PASO_VALIDACION, 'atras')
    t = mostrarMensaje(t, {
      tipo: 'error',
      titulo: 'Necesitamos validar tus datos otra vez',
      texto: conClave
        ? 'La clave de la encuesta no funcionó; puede que la hayan cambiado. Pídela a la persona que acompaña la encuesta, escríbela y oprime "Siguiente". Luego vuelves a donde ibas.'
        : 'Revisa tu documento y tu fecha de nacimiento y oprime "Siguiente". Luego vuelves a donde ibas.',
    })
    if (conClave) {
      t = { ...t, pedirClave: true, pedido: pedir(t, { foco: 'clave', sinDesplazar: true, alinearTarjeta: true }) }
    }
    return t
  }

  if (error.codigo === 'documento_repetido') {
    return mostrarMensaje(s, {
      tipo: 'error',
      titulo: 'Ya hay una respuesta registrada con este documento',
      texto: `Si escribiste mal el número, corrígelo y vuelve a enviar. Si crees que es un error, escríbenos a ${INSTRUMENTO.contacto}.`,
      acciones: ['revisar-documento'],
    })
  }

  if (error.codigo === 'version') {
    return mostrarMensaje(s, {
      tipo: 'error',
      titulo: 'El formulario se actualizó',
      texto: 'Recarga la página para continuar. Tus respuestas se conservan.',
      acciones: ['recargar'],
    })
  }

  return mostrarMensaje(s, {
    tipo: 'error',
    titulo: 'No pudimos enviar tus respuestas',
    texto: 'Revisa tu conexión a internet y vuelve a intentarlo. Tus respuestas siguen guardadas en esta página.',
    acciones: ['reintentar'],
  })
}

export function mensajeEspera(e: Estado): Estado {
  return mostrarMensaje(e, {
    tipo: 'espera',
    titulo: 'La conexión está lenta',
    texto: 'Seguimos intentando enviar tus respuestas. No cierres esta página.',
  })
}

/** En una sala de sistemas varios estudiantes pueden usar la misma pestaña. */
export function nuevaEncuesta(e: Estado): Estado {
  return { ...estadoInicial(), pedido: pedir(e, { foco: 'titulo-vista', sinDesplazar: true, alInicio: true }) }
}

// ── Borrador ─────────────────────────────────────────────────────────────

export function aBorrador(e: Estado): Borrador {
  if (e.vista === 'final') return { vista: 'final', codigo: e.codigo }
  return {
    vista: e.vista,
    respuestas: e.respuestas,
    omitidas: [...e.omitidas],
    actual: e.actual,
    consentimientoEn: e.consentimientoEn,
    iniciadaEn: e.iniciadaEn,
    idEnvio: e.idEnvio,
    // Con la clave hay que conservarla hasta el envío: el servidor la vuelve a comprobar.
    validacion: e.validacion,
    volverA: e.volverA,
  }
}

/**
 * Retoma un borrador: quien recarga a mitad de la encuesta vuelve a la pregunta
 * en la que iba, salvo que no haya pasado la validación (por ejemplo, un
 * borrador anterior): entonces valida primero y después vuelve a esa pregunta.
 */
export function restaurar(e: Estado, borrador: Borrador | null, nuevoId: () => string): Estado {
  if (!borrador) return e
  if (borrador.vista === 'final' && borrador.codigo) return { ...e, vista: 'final', codigo: borrador.codigo }

  let s: Estado = {
    ...e,
    respuestas: borrador.respuestas ?? {},
    omitidas: borrador.omitidas ?? [],
    actual: borrador.actual ?? null,
    consentimientoEn: borrador.consentimientoEn ?? null,
    iniciadaEn: borrador.iniciadaEn ?? null,
    idEnvio: borrador.idEnvio ?? null,
    validacion: borrador.validacion ?? null,
    volverA: borrador.volverA ?? null,
  }
  if (borrador.vista === 'encuesta' && s.consentimientoEn) s = { ...s, vista: 'encuesta' }
  else if (borrador.vista === 'politicas') s = { ...s, vista: 'politicas' }

  if (s.vista === 'encuesta') {
    s = { ...s, actual: preguntaActual(s).id, idEnvio: s.idEnvio ?? nuevoId() }
    if (despuesDeValidacion(s.actual) && !validacionVigente(s)) {
      s = { ...s, volverA: s.actual, actual: PASO_VALIDACION }
    }
  }
  return s
}
