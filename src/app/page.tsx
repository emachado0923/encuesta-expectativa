import Encuesta from '@/componentes/encuesta/Encuesta'

export default function Inicio() {
  return (
    <>
      <noscript>
        <div className="contenedor">
          <p className="tarjeta">Para responder la encuesta necesitas activar JavaScript en tu navegador.</p>
        </div>
      </noscript>
      <Encuesta />
    </>
  )
}
