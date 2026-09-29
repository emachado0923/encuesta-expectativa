/** Los campos de cada tipo de pregunta y el paso de validación (documento, fecha y clave). */

import * as flujo from '@/lib/encuesta/flujo'
import type { Estado } from '@/lib/encuesta/flujo'
import { PREGUNTAS } from '@/lib/encuesta/instrumento'
import type { Pregunta } from '@/lib/encuesta/instrumento'
import { formatoDocumento, hoyIso, limpiarDocumento } from '@/lib/encuesta/logica'

import { Icono } from './Icono'
import type { Acciones } from './useEncuesta'

/** Los id que enlazan la pregunta con su campo, para los lectores de pantalla. */
export type Ids = { texto: string; ayuda: string | null; error: string }

const ETIQUETA_TIPO_DOCUMENTO = new Map(PREGUNTAS.find((p) => p.id === 'tipo_documento')?.opciones ?? [])

const describir = (ids: Ids) => [ids.ayuda, ids.error].filter(Boolean).join(' ') || undefined
const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '')

/** Acepta dd/mm/aaaa en navegadores sin selector de fecha. */
function normalizarFecha(valor: string): string {
  const partes = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(valor.trim())
  if (!partes) return valor.trim()
  const [, dia, mes, anio] = partes
  return `${anio}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

type Comunes = { 'aria-labelledby'?: string; 'aria-describedby'?: string; 'aria-invalid'?: true }

export function Campo({
  estado,
  pregunta,
  ids,
  acciones,
}: {
  estado: Estado
  pregunta: Pregunta
  ids: Ids
  acciones: Acciones
}) {
  const invalido = Boolean(estado.errores[pregunta.id])
  const comunes: Comunes = {
    'aria-labelledby': ids.texto,
    'aria-describedby': describir(ids),
    'aria-invalid': invalido || undefined,
  }
  const valor = estado.respuestas[pregunta.id]
  const responder = (nuevo: unknown) => acciones.responder(pregunta.id, nuevo)

  if (pregunta.tipo === 'unica' || pregunta.tipo === 'multiple') {
    return <CampoOpciones pregunta={pregunta} ids={ids} valor={valor} invalido={invalido} responder={responder} />
  }
  if (pregunta.tipo === 'fecha') return <CampoFecha pregunta={pregunta} valor={valor} comunes={comunes} responder={responder} />
  if (pregunta.tipo === 'documento') {
    return <CampoDocumento estado={estado} pregunta={pregunta} comunes={comunes} acciones={acciones} />
  }
  return (
    <input
      {...comunes}
      className="campo"
      type="text"
      id={pregunta.id}
      value={texto(valor)}
      maxLength={pregunta.maxLongitud}
      autoComplete="off"
      onChange={(evento) => responder(evento.target.value)}
    />
  )
}

function CampoOpciones({
  pregunta,
  ids,
  valor,
  invalido,
  responder,
}: {
  pregunta: Pregunta
  ids: Ids
  valor: unknown
  invalido: boolean
  responder: (valor: unknown) => void
}) {
  const multiple = pregunta.tipo === 'multiple'
  const opciones = pregunta.opciones ?? []
  const marcadas = multiple && Array.isArray(valor) ? (valor as string[]) : []

  return (
    <div
      className="opciones"
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={ids.texto}
      aria-describedby={describir(ids)}
    >
      {opciones.map(([opcion, etiqueta]) => {
        const id = `${pregunta.id}--${opcion}`
        return (
          <label key={opcion} className={`opcion opcion--${multiple ? 'multiple' : 'unica'}`} htmlFor={id}>
            <input
              className="opcion__control"
              type={multiple ? 'checkbox' : 'radio'}
              name={pregunta.id}
              value={opcion}
              id={id}
              checked={multiple ? marcadas.includes(opcion) : valor === opcion}
              aria-invalid={invalido || undefined}
              onChange={(evento) => {
                if (!multiple) return responder(opcion)
                // En el orden de las opciones, como las marcaría la lista de casillas.
                const nuevas = opciones
                  .map(([o]) => o)
                  .filter((o) => (o === opcion ? evento.target.checked : marcadas.includes(o)))
                return responder(nuevas)
              }}
            />
            <span className="opcion__caja">
              <span className="opcion__marca">
                <Icono nombre="check" />
              </span>
              <span className="opcion__texto">{etiqueta}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

function CampoFecha({
  pregunta,
  valor,
  comunes,
  responder,
}: {
  pregunta: Pregunta
  valor: unknown
  comunes: Comunes
  responder: (valor: unknown) => void
}) {
  return (
    <input
      {...comunes}
      className="campo campo--fecha"
      type="date"
      id={pregunta.id}
      value={texto(valor)}
      min={pregunta.min}
      max={pregunta.max ?? hoyIso()}
      placeholder="AAAA-MM-DD"
      onChange={(evento) => responder(normalizarFecha(evento.target.value))}
    />
  )
}

function CampoDocumento({
  estado,
  pregunta,
  comunes,
  acciones,
}: {
  estado: Estado
  pregunta: Pregunta
  comunes: Comunes
  acciones: Acciones
}) {
  const formato = formatoDocumento(estado.respuestas)
  if (!formato) {
    return (
      <div className="mensaje">
        <Icono nombre="alerta" />
        <div>
          <p>Primero elige tu tipo de documento: de eso depende cómo se escribe el número.</p>
          <div className="acciones">
            <button type="button" className="boton boton--contorno" onClick={() => acciones.irA('tipo_documento')}>
              <Icono nombre="flecha-izq" />
              {`Ir a la pregunta ${flujo.numeroDe(estado, 'tipo_documento')}`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const numerico = formato === 'numerico'
  const tipo = ETIQUETA_TIPO_DOCUMENTO.get(String(estado.respuestas.tipo_documento))
  return (
    <>
      <input
        {...comunes}
        className="campo campo--documento"
        type="text"
        id={pregunta.id}
        value={texto(estado.respuestas[pregunta.id])}
        // Colombianos: teclado numérico. Extranjeros: teclado completo, porque traen letras.
        inputMode={numerico ? 'numeric' : 'text'}
        pattern={numerico ? '[0-9]*' : undefined}
        autoCapitalize={numerico ? undefined : 'characters'}
        autoComplete="off"
        spellCheck={false}
        maxLength={numerico ? 15 : 20}
        onChange={(evento) => {
          const valor = evento.target.value
          acciones.responder(pregunta.id, numerico ? valor.replace(/\D/g, '') : limpiarDocumento(valor))
        }}
      />
      <p className="campo__nota">
        {`${tipo}: ${numerico ? 'solo números, sin puntos ni espacios.' : 'letras, números o guiones, sin espacios.'}`}
      </p>
    </>
  )
}

/**
 * Número de documento y fecha de nacimiento en la misma tarjeta, con la edad
 * debajo de la fecha. Si el documento no está en la lista, o no hay documento,
 * se pide la clave de la encuesta.
 */
export function PasoValidacion({
  estado,
  pregunta,
  ids,
  acciones,
}: {
  estado: Estado
  pregunta: Pregunta
  ids: Ids
  acciones: Acciones
}) {
  const invalido = (id: string) => (estado.errores[id] ? true : undefined)
  const descritoPor = (...extra: (string | false)[]) => [...extra, ids.error].filter(Boolean).join(' ')
  const numero = flujo.preguntaPorId(flujo.PREGUNTA_NUMERO)
  const conDocumento = flujo.tieneDocumento(estado)

  return (
    <>
      {conDocumento && (
        <div className="validacion__campo">
          <label className="campo__etiqueta" htmlFor={numero.id}>
            {numero.texto}
          </label>
          <CampoDocumento
            estado={estado}
            pregunta={numero}
            comunes={{ 'aria-describedby': descritoPor(), 'aria-invalid': invalido(numero.id) }}
            acciones={acciones}
          />
        </div>
      )}

      <div className="validacion__campo">
        <label className="campo__etiqueta" htmlFor={pregunta.id}>
          {pregunta.texto}
        </label>
        <CampoFecha
          pregunta={pregunta}
          valor={estado.respuestas[pregunta.id]}
          comunes={{ 'aria-describedby': descritoPor('edad'), 'aria-invalid': invalido(pregunta.id) }}
          responder={(valor) => acciones.responder(pregunta.id, valor)}
        />
        <p className="campo__nota edad" id="edad" aria-live="polite">
          {flujo.textoEdad(estado)}
        </p>
      </div>

      {/* El campo de la clave se describe con el motivo por el que aparece: al
          enfocarlo, el lector de pantalla dice por qué se pide. */}
      <div className="mensaje validacion__clave" id="bloque-clave" hidden={conDocumento && !estado.pedirClave}>
        <Icono nombre="candado" />
        <div>
          <p id="motivo-clave">
            <strong>
              {conDocumento
                ? 'Tu documento no está en la lista de estudiantes.'
                : 'Para responder sin documento necesitas la clave de la encuesta.'}
            </strong>
          </p>
          {conDocumento && (
            <p id="explicacion-clave">
              Revisa que esté bien escrito. Si lo está, puedes seguir con la clave de la encuesta.
            </p>
          )}
          <label className="campo__etiqueta" htmlFor="clave">
            Clave de la encuesta
          </label>
          <input
            className="campo campo--clave"
            type="text"
            id="clave"
            value={estado.claveEscrita}
            maxLength={100}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={descritoPor('motivo-clave', conDocumento && 'explicacion-clave', 'nota-clave')}
            aria-invalid={invalido('clave')}
            onChange={(evento) => acciones.escribirClave(evento.target.value)}
          />
          <p className="campo__nota" id="nota-clave">
            Pídela a la persona que acompaña la encuesta.
          </p>
        </div>
      </div>
    </>
  )
}
