'use client'

/**
 * La encuesta: bienvenida → aviso de datos → preguntas (una a la vez) → final.
 * El estado y las acciones están en useEncuesta; aquí se elige la vista.
 */

import { Bienvenida, Final, Politicas } from './Portada'
import { useEncuesta } from './useEncuesta'
import { VistaEncuesta } from './VistaEncuesta'

export default function Encuesta() {
  const { estado, acciones } = useEncuesta()

  switch (estado.vista) {
    case 'politicas':
      return (
        <Politicas
          yaAcepto={Boolean(estado.consentimientoEn)}
          alVolver={acciones.volverABienvenida}
          alContinuar={acciones.comenzar}
        />
      )
    case 'encuesta':
      return <VistaEncuesta estado={estado} acciones={acciones} />
    case 'final':
      return <Final codigo={estado.codigo} alEmpezarOtra={acciones.nuevaEncuesta} />
    default:
      return <Bienvenida alComenzar={acciones.irAPoliticas} />
  }
}
