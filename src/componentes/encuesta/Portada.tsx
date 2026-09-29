/** Las vistas fuera de las preguntas: bienvenida, aviso de datos y final. */

import { useRef, useState } from 'react'

import { AVISO_DATOS, INSTRUMENTO } from '@/lib/encuesta/instrumento'
import { RANGO_PREGUNTAS } from '@/lib/encuesta/logica'

import { Icono } from './Icono'
import type { NombreIcono } from './Icono'

function Dato({ icono, titulo, texto }: { icono: NombreIcono; titulo: string; texto?: string }) {
  return (
    <li className="dato">
      <span className="dato__icono">
        <Icono nombre={icono} />
      </span>
      <p>
        <strong>{titulo}</strong>
        {texto && <span>{texto}</span>}
      </p>
    </li>
  )
}

export function Bienvenida({ alComenzar }: { alComenzar: () => void }) {
  const { minimo, maximo } = RANGO_PREGUNTAS
  return (
    <div className="contenedor">
      <section className="tarjeta portada" aria-labelledby="titulo-vista">
        <h1 className="titulo" id="titulo-vista" tabIndex={-1}>
          {INSTRUMENTO.titulo}
        </h1>
        <p className="entrada">{INSTRUMENTO.publico}</p>
        <p className="texto">{INSTRUMENTO.descripcion}</p>
        <ul className="datos">
          <Dato icono="reloj" titulo={`Aproximadamente ${INSTRUMENTO.minutos} minutos`} />
          <Dato
            icono="lista"
            titulo={`Entre ${minimo} y ${maximo} preguntas`}
            texto="Una a la vez. Puedes volver a cualquiera."
          />
          <Dato icono="candado" titulo="Tus datos, protegidos" texto="Uso estadístico, según la Ley 1581 de 2012." />
        </ul>
        <div className="acciones">
          <button type="button" className="boton boton--primario boton--grande" onClick={alComenzar}>
            Comenzar
            <Icono nombre="flecha-der" />
          </button>
        </div>
      </section>
    </div>
  )
}

export function Politicas({
  yaAcepto,
  alVolver,
  alContinuar,
}: {
  yaAcepto: boolean
  alVolver: () => void
  alContinuar: () => void
}) {
  const [marcada, setMarcada] = useState(yaAcepto)
  const [falta, setFalta] = useState(false)
  const casilla = useRef<HTMLInputElement>(null)

  function continuar() {
    if (!marcada) {
      setFalta(true)
      casilla.current?.focus()
      return
    }
    alContinuar()
  }

  return (
    <div className="contenedor">
      <section className="tarjeta" aria-labelledby="titulo-vista">
        <p className="antetitulo">Antes de empezar</p>
        <h1 className="titulo" id="titulo-vista" tabIndex={-1}>
          {AVISO_DATOS.titulo}
        </h1>
        <div className="aviso">
          {AVISO_DATOS.parrafos.map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
          <p>
            Si tienes preguntas sobre tus datos, escríbenos a{' '}
            <a className="enlace" href={`mailto:${INSTRUMENTO.contacto}`}>
              {INSTRUMENTO.contacto}
            </a>
            .
          </p>
          {INSTRUMENTO.politicaUrl && (
            <p>
              <a className="enlace" href={INSTRUMENTO.politicaUrl} target="_blank" rel="noopener">
                Leer la política completa de tratamiento de datos
                <Icono nombre="externo" />
              </a>
            </p>
          )}
        </div>
        <fieldset className="autorizaciones" aria-describedby="error-autorizacion">
          <legend className="solo-lector">Autorizaciones</legend>
          <label className="casilla" htmlFor="autoriza">
            <input
              ref={casilla}
              type="checkbox"
              id="autoriza"
              checked={marcada}
              onChange={(evento) => {
                setMarcada(evento.target.checked)
                if (evento.target.checked) setFalta(false)
              }}
            />
            <span>{AVISO_DATOS.autorizacion}</span>
          </label>
        </fieldset>
        {/* Oculto y vacío: el lector de pantalla lo lee solo cuando aparece. */}
        <p className="pregunta__error" id="error-autorizacion" role="alert" hidden={!falta}>
          <Icono nombre="alerta" />
          <span>{falta ? 'Para continuar, marca la casilla.' : ''}</span>
        </p>
        <div className="acciones acciones--separadas">
          <button type="button" className="boton boton--contorno" onClick={alVolver}>
            <Icono nombre="flecha-izq" />
            Volver
          </button>
          <button type="button" className="boton boton--primario" onClick={continuar}>
            Aceptar y continuar
            <Icono nombre="flecha-der" />
          </button>
        </div>
      </section>
    </div>
  )
}

export function Final({ codigo, alEmpezarOtra }: { codigo: string | null; alEmpezarOtra: () => void }) {
  return (
    <div className="contenedor">
      <section className="tarjeta final" aria-labelledby="titulo-vista">
        <span className="final__sello">
          <Icono nombre="listo" />
        </span>
        <h1 className="titulo" id="titulo-vista" tabIndex={-1}>
          ¡Gracias! Tus respuestas quedaron registradas
        </h1>
        <p className="texto">
          Lo que respondiste ayuda a Sapiencia y a la Alcaldía de Medellín a diseñar mejores apoyos para quienes
          terminan el bachillerato.
        </p>
        {codigo && (
          <p className="codigo">
            <span>Código de registro</span>
            <strong>{codigo}</strong>
          </p>
        )}
        <div className="recomendado">
          <p>
            <strong>¿Todavía estás decidiendo?</strong>
            Explora los programas de educación postsecundaria que hay en Medellín.
          </p>
          <a className="boton" href={INSTRUMENTO.guiaOfertaUrl} target="_blank" rel="noopener">
            Guía Digital de Oferta
            <Icono nombre="externo" />
          </a>
        </div>
        <div className="acciones">
          {/* En una sala de sistemas varios estudiantes pueden usar la misma pestaña. */}
          <button type="button" className="boton boton--texto" onClick={alEmpezarOtra}>
            Empezar una encuesta nueva
          </button>
        </div>
      </section>
    </div>
  )
}
