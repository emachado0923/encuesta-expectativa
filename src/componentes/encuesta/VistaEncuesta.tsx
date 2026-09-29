/** La vista de las preguntas: avance y números, avisos, la pregunta en pantalla y la navegación. */

import { Fragment, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'

import * as flujo from '@/lib/encuesta/flujo'
import type { EstadoNumero, Estado, Mensaje } from '@/lib/encuesta/flujo'
import { PASO_VALIDACION, seccionDe } from '@/lib/encuesta/logica'

import { Campo, PasoValidacion } from './Campos'
import type { Ids } from './Campos'
import { Icono } from './Icono'
import type { Acciones } from './useEncuesta'

const ETIQUETA_ESTADO: Record<EstadoNumero, string> = {
  completa: 'respondida',
  omitida: 'omitida',
  falta: 'falta responder',
  pendiente: 'sin responder',
}

export function VistaEncuesta({ estado, acciones }: { estado: Estado; acciones: Acciones }) {
  return (
    <div className="encuesta">
      <Avance estado={estado} alSaltar={acciones.saltarA} />
      <div className="contenedor encuesta__cuerpo">
        <div className="encuesta__mensaje">
          {estado.mensaje && <AvisoEncuesta mensaje={estado.mensaje} alAccion={acciones.accionMensaje} />}
        </div>
        <TarjetaPregunta estado={estado} acciones={acciones} />
      </div>
      <Navegacion estado={estado} alAnterior={acciones.anterior} />
    </div>
  )
}

function Avance({ estado, alSaltar }: { estado: Estado; alSaltar: (id: string) => void }) {
  const inicio = flujo.enInicio(estado)
  const { porcentaje, conteo, textoAccesible } = flujo.avance(estado)
  const { lista, aviso } = flujo.circulos(estado)
  const fila = useRef<HTMLOListElement>(null)
  const firma = JSON.stringify([lista.map((c) => c.estado), estado.actual, aviso])

  // En el celular la fila de números se desplaza: se deja a la vista el actual.
  useEffect(() => {
    const contenedor = fila.current
    const boton = contenedor?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!contenedor || !boton || contenedor.scrollWidth <= contenedor.clientWidth) return
    contenedor.scrollLeft = boton.offsetLeft - contenedor.clientWidth / 2 + boton.offsetWidth / 2
  }, [firma])

  return (
    <div className="avance">
      <div className="contenedor">
        <div className="avance__fila">
          <span className="avance__conteo">{conteo}</span>
          <span className="avance__porcentaje" aria-hidden="true" hidden={inicio}>
            {porcentaje} %
          </span>
        </div>
        <div
          className="avance__barra"
          role="progressbar"
          aria-label="Avance de la encuesta"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={porcentaje}
          aria-valuetext={textoAccesible}
          hidden={inicio}
        >
          <span className="avance__relleno" style={{ width: `${porcentaje}%` }} />
        </div>
        <nav className="numeros" aria-label="Ir a una pregunta">
          <ol className="numeros__lista" ref={fila}>
            {lista.map((circulo) => (
              <Fragment key={circulo.id}>
                {circulo.corte && <li className="numeros__corte" aria-hidden="true" />}
                <li>
                  <button
                    type="button"
                    className="numero"
                    data-categoria={circulo.categoria}
                    data-estado={circulo.estado}
                    aria-current={circulo.id === estado.actual ? 'step' : undefined}
                    aria-label={`Pregunta ${circulo.numero}, ${ETIQUETA_ESTADO[circulo.estado]}`}
                    title={circulo.titulo}
                    onClick={() => alSaltar(circulo.id)}
                  >
                    {circulo.numero}
                  </button>
                </li>
              </Fragment>
            ))}
            {aviso && (
              <>
                <li className="numeros__corte" aria-hidden="true" />
                <li>
                  <span
                    className="numero numero--futuro"
                    data-categoria="camino"
                    role="img"
                    aria-label={aviso}
                    title={aviso}
                  >
                    …
                  </span>
                </li>
              </>
            )}
          </ol>
        </nav>
      </div>
    </div>
  )
}

const TEXTO_ACCION = {
  'revisar-documento': { clase: 'boton boton--contorno', texto: 'Revisar mi documento', icono: false },
  recargar: { clase: 'boton boton--primario', texto: 'Recargar', icono: true },
  reintentar: { clase: 'boton boton--primario', texto: 'Intentar de nuevo', icono: true },
} as const

function AvisoEncuesta({
  mensaje,
  alAccion,
}: {
  mensaje: Mensaje
  alAccion: (accion: NonNullable<Mensaje['acciones']>[number]) => void
}) {
  const { tipo, titulo, texto, acciones = [] } = mensaje
  return (
    <div className={`mensaje mensaje--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {tipo === 'espera' ? (
        <span className="girando" aria-hidden="true" />
      ) : (
        <Icono nombre={tipo === 'listo' ? 'listo' : 'alerta'} />
      )}
      <div>
        <p>
          <strong>{titulo}</strong>
        </p>
        {texto && <p>{texto}</p>}
        {acciones.length > 0 && (
          <div className="acciones">
            {acciones.map((accion) => {
              const boton = TEXTO_ACCION[accion]
              return (
                <button key={accion} type="button" className={boton.clase} onClick={() => alAccion(accion)}>
                  {boton.icono && <Icono nombre="recargar" />}
                  {boton.texto}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TarjetaPregunta({ estado, acciones }: { estado: Estado; acciones: Acciones }) {
  const pregunta = flujo.preguntaActual(estado)
  const seccion = seccionDe(pregunta)
  const validacion = pregunta.id === PASO_VALIDACION
  const { texto, ayuda } = validacion ? flujo.textosValidacion(estado) : pregunta
  const error = validacion ? flujo.errorValidacion(estado) : estado.errores[pregunta.id]
  const ids: Ids = {
    texto: `texto-${pregunta.id}`,
    ayuda: ayuda ? `ayuda-${pregunta.id}` : null,
    error: `error-${pregunta.id}`,
  }
  const { n, direccion } = estado.navegacion

  // Enter en un campo avanza, sin depender de cómo cada navegador resuelve el envío implícito.
  function alTeclear(evento: KeyboardEvent<HTMLFormElement>) {
    const objetivo = evento.target as HTMLElement
    if (evento.key === 'Enter' && objetivo.matches('input') && !evento.nativeEvent.isComposing) {
      evento.preventDefault()
      acciones.siguiente()
    }
  }

  return (
    // Una tarjeta nueva con cada navegación: así entra animada desde el lado que corresponde.
    <form
      key={n}
      className={`tarjeta pregunta${direccion ? ` pregunta--${direccion}` : ''}`}
      id="pregunta"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault()
        acciones.siguiente()
      }}
      onKeyDown={alTeclear}
    >
      <div className="pregunta__cabecera">
        <span className="antetitulo">{seccion.titulo}</span>
        <span className="pregunta__numero">{flujo.textoNumero(estado, pregunta)}</span>
      </div>
      <h1 className="pregunta__texto" id={ids.texto} tabIndex={-1}>
        {texto}
        {pregunta.obligatoria === false && <span className="etiqueta-opcional">Opcional</span>}
      </h1>
      {ayuda && (
        <p className="pregunta__ayuda" id={ids.ayuda ?? undefined}>
          {ayuda}
        </p>
      )}
      {/* Arriba del campo: en una pregunta con muchas opciones, abajo quedaría fuera de la pantalla.
          Oculto queda vacío: el lector de pantalla lo citaría en la descripción del campo. */}
      <p className="pregunta__error" id={ids.error} role="alert" hidden={!error}>
        <Icono nombre="alerta" />
        <span>{error ?? ''}</span>
      </p>
      <div className="pregunta__campo">
        {validacion ? (
          <PasoValidacion estado={estado} pregunta={pregunta} ids={ids} acciones={acciones} />
        ) : (
          <Campo estado={estado} pregunta={pregunta} ids={ids} acciones={acciones} />
        )}
      </div>
    </form>
  )
}

function Navegacion({ estado, alAnterior }: { estado: Estado; alAnterior: () => void }) {
  const ocupado = estado.enviando || estado.validando
  const ultima = flujo.esUltimoPaso(estado)

  return (
    <div className="navegacion">
      <div className="contenedor navegacion__botones">
        <button
          type="button"
          className="boton boton--contorno"
          onClick={alAnterior}
          disabled={flujo.esPrimerPaso(estado) || ocupado}
        >
          <Icono nombre="flecha-izq" />
          Anterior
        </button>
        <button type="submit" form="pregunta" className="boton boton--primario" disabled={ocupado} aria-busy={ocupado}>
          {ocupado ? (
            <>
              <span className="girando" aria-hidden="true" />
              {estado.enviando ? 'Enviando…' : 'Validando…'}
            </>
          ) : ultima ? (
            <>
              Enviar respuestas
              <Icono nombre="enviar" />
            </>
          ) : (
            <>
              Siguiente
              <Icono nombre="flecha-der" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
