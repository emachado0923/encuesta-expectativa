/**
 * El estado de la encuesta y sus acciones. Las reglas están en
 * src/lib/encuesta/flujo.ts (funciones puras); aquí se conectan con React, con
 * el borrador en sessionStorage, con la red y con la página (foco y desplazamiento).
 *
 * El estado vive en un almacén pequeño leído con useSyncExternalStore: las
 * acciones que esperan la red (validar, enviar) necesitan el estado del momento
 * en que vuelve la respuesta, no el que había cuando empezaron.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'

import { borrarBorrador, guardarBorrador, leerBorrador } from '@/lib/cliente/borrador'
import { ErrorEnvio, enviarRespuestas, nuevoId, validarDatos } from '@/lib/cliente/envio'
import * as flujo from '@/lib/encuesta/flujo'
import type { AccionMensaje, Estado, Paso } from '@/lib/encuesta/flujo'
import { PASO_VALIDACION } from '@/lib/encuesta/logica'

type Almacen = {
  obtener: () => Estado
  fijar: (cambio: (e: Estado) => Estado) => void
  suscribir: (oyente: () => void) => () => void
}

function crearAlmacen(inicial: Estado): Almacen {
  let estado = inicial
  const oyentes = new Set<() => void>()
  return {
    obtener: () => estado,
    fijar: (cambio) => {
      estado = cambio(estado)
      oyentes.forEach((oyente) => oyente())
    },
    suscribir: (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
  }
}

const movimientoReducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function useEncuesta() {
  const [almacen] = useState(() => crearAlmacen(flujo.estadoInicial()))
  const estado = useSyncExternalStore(almacen.suscribir, almacen.obtener, almacen.obtener)
  const recargando = useRef(false)

  // Quien recarga a mitad de la encuesta la retoma donde iba (solo en el
  // navegador). Desde ahí, cada cambio se guarda en el borrador.
  useEffect(() => {
    almacen.fijar((e) => flujo.restaurar(e, leerBorrador(), nuevoId))
    return almacen.suscribir(() => guardarBorrador(flujo.aBorrador(almacen.obtener())))
  }, [almacen])

  // Después de dibujar: enfocar y desplazar lo que pidió la última acción.
  useEffect(() => {
    const pedido = estado.pedido
    if (!pedido) return
    if (pedido.alInicio) window.scrollTo(0, 0)
    if (pedido.alinearTarjeta) {
      // Si se había bajado en una pregunta larga, la siguiente empieza arriba.
      const tarjeta = document.getElementById('pregunta')
      const avance = document.querySelector<HTMLElement>('.avance')
      if (tarjeta && avance) {
        const arriba = tarjeta.getBoundingClientRect().top - avance.offsetHeight - 12
        if (arriba < 0) window.scrollBy({ top: arriba, behavior: movimientoReducido() ? 'auto' : 'smooth' })
      }
    }
    if (pedido.primerCampo) document.getElementById('pregunta')?.querySelector('input')?.focus()
    if (pedido.foco) {
      document.getElementById(pedido.foco)?.focus(pedido.sinDesplazar ? { preventScroll: true } : undefined)
    }
  }, [estado.pedido])

  // Un aviso nuevo sobre la pregunta se deja a la vista.
  useEffect(() => {
    if (!estado.mensaje) return
    const caja = document.querySelector('.encuesta__mensaje')?.getBoundingClientRect()
    const avance = document.querySelector<HTMLElement>('.avance')
    if (!caja || !avance) return
    if (caja.top < avance.offsetHeight || caja.top > window.innerHeight) {
      window.scrollBy({ top: caja.top - avance.offsetHeight - 12, behavior: movimientoReducido() ? 'auto' : 'smooth' })
    }
  }, [estado.mensaje])

  // Cerrar la pestaña a mitad de la encuesta borra el borrador: se avisa antes.
  // Recargar no lo borra, así que el botón "Recargar" no pregunta.
  useEffect(() => {
    const alSalir = (evento: BeforeUnloadEvent) => {
      if (recargando.current) return
      const e = almacen.obtener()
      const aMitad = e.vista === 'encuesta' && Object.keys(e.respuestas).length > 0
      if (aMitad || e.enviando) evento.preventDefault()
    }
    window.addEventListener('beforeunload', alSalir)
    return () => window.removeEventListener('beforeunload', alSalir)
  }, [almacen])

  const acciones = useMemo(() => {
    async function enviar() {
      const preparado = flujo.prepararEnvio(almacen.obtener())
      almacen.fijar(() => preparado.estado)
      if (preparado.tipo === 'faltan') return
      try {
        const recibo = await enviarRespuestas(preparado.cuerpo, {
          alReintentar: () => almacen.fijar(flujo.mensajeEspera),
        })
        almacen.fijar((e) => flujo.envioExitoso(e, recibo.codigo))
      } catch (error) {
        const fallo = error instanceof ErrorEnvio ? error : {}
        almacen.fijar((e) => flujo.envioFallido(e, fallo))
      }
    }

    /** Aplica un paso y, si toca, envía. */
    function aplicar(paso: Paso) {
      almacen.fijar(() => paso.estado)
      if (paso.enviar) void enviar()
    }

    async function validarPaso() {
      const preparado = flujo.prepararValidacion(almacen.obtener())
      if (preparado.tipo === 'resuelto') return aplicar(preparado)

      almacen.fijar((e) => ({ ...e, validando: true }))
      let resultado = 'fallo'
      let errores: Record<string, string> | null = null
      try {
        ;({ resultado } = await validarDatos(preparado.datos))
      } catch (error) {
        errores = error instanceof ErrorEnvio ? error.errores : null
      }
      aplicar(flujo.aplicarValidacion(almacen.obtener(), preparado, resultado, errores))
    }

    return {
      irAPoliticas: () => almacen.fijar((e) => flujo.cambiarVista(e, 'politicas')),
      volverABienvenida: () => almacen.fijar((e) => flujo.cambiarVista(e, 'bienvenida')),
      comenzar: () => almacen.fijar((e) => flujo.comenzar(e, new Date().toISOString(), nuevoId())),
      responder: (preguntaId: string, valor: unknown) => almacen.fijar((e) => flujo.responder(e, preguntaId, valor)),
      escribirClave: (texto: string) => almacen.fijar((e) => flujo.escribirClave(e, texto)),
      saltarA: (id: string) => almacen.fijar((e) => flujo.saltarA(e, id)),
      irA: (id: string) => almacen.fijar((e) => flujo.irA(e, id, 'atras')),
      anterior: () => almacen.fijar(flujo.anterior),

      siguiente: () => {
        const e = almacen.obtener()
        if (e.enviando || e.validando) return
        if (flujo.preguntaActual(e).id === PASO_VALIDACION) return void validarPaso()
        aplicar(flujo.siguiente(e))
      },

      accionMensaje: (accion: AccionMensaje) => {
        if (accion === 'revisar-documento') {
          almacen.fijar((e) => flujo.irA(flujo.ocultarMensaje(e), PASO_VALIDACION, 'atras'))
        } else if (accion === 'recargar') {
          recargando.current = true
          window.location.reload()
        } else {
          void enviar()
        }
      },

      nuevaEncuesta: () => {
        borrarBorrador()
        almacen.fijar(flujo.nuevaEncuesta)
      },
    }
  }, [almacen])

  return { estado, acciones }
}

export type Acciones = ReturnType<typeof useEncuesta>['acciones']
