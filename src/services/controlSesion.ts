import { watch } from 'vue'

import { ErrorApi } from './api'

import {
  cerrarSesion,
  CLAVE_EVENTO_SESION,
  consultarSesion,
  estadoSesion,
  marcarSesionNoConfirmada,
  versionSesion,
} from './authService'

/*
 * Este tiempo debe coincidir con el configurado
 * en application.properties.
 */
const INACTIVIDAD_MS = 30 * 60 * 1000

/*
 * Mientras haya actividad real, se comprueba la sesión
 * como máximo cada cinco minutos.
 */
const RENOVACION_MS = 5 * 60 * 1000
const REINTENTO_RED_MS = 30 * 1000

const CLAVE_ACTIVIDAD = 'trabajo-infantil-ultima-actividad'

export type MotivoFinSesion = 'inactividad' | 'sesion' | 'sin-confirmar'

export function iniciarControlSesion(alTerminar: (motivo: MotivoFinSesion) => void): () => void {
  let iniciado = true
  let enCierre = false
  let enConsulta = false
  let consultaPendiente = false

  let ultimoIntento = 0
  let ultimaActividad = Date.now()
  let ultimaEscritura = 0

  let sincronizacionDisponible = true
  let temporizador: number | undefined

  function sesionEstaInactiva(): boolean {
    return estadoSesion.value === 'inactiva'
  }

  function cancelarTemporizador(): void {
    if (temporizador !== undefined) {
      window.clearTimeout(temporizador)
    }

    temporizador = undefined
  }

  function guardarActividad(instante: number): void {
    ultimaActividad = instante

    try {
      localStorage.setItem(CLAVE_ACTIVIDAD, String(instante))

      ultimaEscritura = instante
    } catch {
      /*
       * Si no se pueden sincronizar las pestañas,
       * el vencimiento queda a cargo del servidor.
       */
      sincronizacionDisponible = false
      cancelarTemporizador()
    }
  }

  function leerActividad(): number {
    if (!sincronizacionDisponible) {
      return ultimaActividad
    }

    try {
      const guardada = Number(localStorage.getItem(CLAVE_ACTIVIDAD))

      const valida = Number.isFinite(guardada) && guardada > 0 && guardada <= Date.now() + 60000

      return valida ? Math.max(ultimaActividad, guardada) : ultimaActividad
    } catch {
      sincronizacionDisponible = false
      cancelarTemporizador()

      return ultimaActividad
    }
  }

  function programarCierre(): void {
    cancelarTemporizador()

    if (!iniciado || !sincronizacionDisponible || estadoSesion.value !== 'activa' || enCierre) {
      return
    }

    const ultima = leerActividad()

    if (!sincronizacionDisponible) {
      return
    }

    const restante = INACTIVIDAD_MS - (Date.now() - ultima)

    /*
     * Esta pequeña tolerancia ayuda a sincronizar
     * la actividad entre pestañas.
     */
    temporizador = window.setTimeout(
      () => void cerrarPorInactividad(),
      Math.max(0, restante + 1000),
    )
  }

  async function cerrarPorInactividad(): Promise<void> {
    if (!iniciado || enCierre || estadoSesion.value !== 'activa') {
      return
    }

    if (!sincronizacionDisponible) {
      return
    }

    if (Date.now() - leerActividad() < INACTIVIDAD_MS) {
      programarCierre()
      return
    }

    enCierre = true

    const versionInicial = versionSesion()
    const controlador = new AbortController()

    /*
     * Si no hay conexión, no esperamos indefinidamente
     * a que responda el servidor.
     */
    const limite = window.setTimeout(() => controlador.abort(), 8000)

    try {
      await cerrarSesion(controlador.signal)

      if (iniciado && sesionEstaInactiva()) {
        alTerminar('inactividad')
      }
    } catch {
      if (iniciado && versionSesion() === versionInicial + 1) {
        marcarSesionNoConfirmada()
        alTerminar('sin-confirmar')
      }
    } finally {
      window.clearTimeout(limite)
      enCierre = false
    }
  }

  async function comprobarSesion(): Promise<void> {
    if (!iniciado || enCierre) {
      return
    }

    if (enConsulta) {
      consultaPendiente = true
      return
    }

    enConsulta = true

    let sesionPerdida = false

    do {
      consultaPendiente = false

      const estabaActiva = estadoSesion.value === 'activa'

      const version = versionSesion()

      ultimoIntento = Date.now()

      try {
        await consultarSesion()
        sesionPerdida = false
      } catch (error) {
        if (
          version === versionSesion() &&
          error instanceof ErrorApi &&
          (error.estado === 401 || error.estado === 403)
        ) {
          sesionPerdida ||= estabaActiva
        } else {
          /*
           * Un problema de conexión no demuestra
           * que la sesión se haya cerrado.
           */
          ultimoIntento = Date.now() - RENOVACION_MS + REINTENTO_RED_MS
        }
      }
    } while (consultaPendiente && iniciado && !enCierre)

    enConsulta = false

    if (iniciado && !enCierre && sesionPerdida && estadoSesion.value === 'inactiva') {
      alTerminar('sesion')
    }
  }

  function registrarActividad(evento: Event): void {
    if (
      !iniciado ||
      enCierre ||
      !evento.isTrusted ||
      document.visibilityState !== 'visible' ||
      estadoSesion.value !== 'activa'
    ) {
      return
    }

    const ahora = Date.now()

    // No procesamos cada pequeño movimiento del puntero.
    if (ahora - ultimaActividad < 1000) {
      return
    }

    if (sincronizacionDisponible && ahora - leerActividad() >= INACTIVIDAD_MS) {
      void cerrarPorInactividad()
      return
    }

    ultimaActividad = ahora

    if (sincronizacionDisponible && ahora - ultimaEscritura >= 1000) {
      guardarActividad(ahora)
    }

    programarCierre()

    if (ahora - ultimoIntento >= RENOVACION_MS) {
      void comprobarSesion()
    }
  }

  function cambioAlmacenamiento(evento: StorageEvent): void {
    if (evento.key === CLAVE_ACTIVIDAD && estadoSesion.value === 'activa') {
      programarCierre()
    } else if (evento.key === CLAVE_EVENTO_SESION && evento.newValue) {
      void comprobarSesion()
    }
  }

  const eventos = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

  for (const evento of eventos) {
    window.addEventListener(evento, registrarActividad, { passive: true })
  }

  window.addEventListener('storage', cambioAlmacenamiento)

  const detenerObservacion = watch(
    estadoSesion,
    (actual, anterior) => {
      if (actual === 'activa' && anterior !== 'activa') {
        guardarActividad(Date.now())
        ultimoIntento = Date.now()
        programarCierre()
      } else if (actual !== 'activa') {
        cancelarTemporizador()
      }
    },
    {
      immediate: true,
      flush: 'sync',
    },
  )

  // Comprueba si ya había una sesión al abrir o recargar.
  void comprobarSesion()

  return () => {
    iniciado = false
    cancelarTemporizador()
    detenerObservacion()

    for (const evento of eventos) {
      window.removeEventListener(evento, registrarActividad)
    }

    window.removeEventListener('storage', cambioAlmacenamiento)
  }
}
