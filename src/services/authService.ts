import { readonly, ref } from 'vue'

import { ErrorApi, solicitarApi } from './api'

export type SesionAdministrador = {
  id: number
  nombre: string
  correo: string
  mensaje?: string
}

export type TokenCsrf = {
  header: string
  token: string
}

export type EstadoSesion = 'verificando' | 'activa' | 'inactiva' | 'error'

export const CLAVE_EVENTO_SESION = 'trabajo-infantil-evento-sesion'

/*
 * Este estado se comparte entre las páginas del frontend.
 * La sesión real sigue estando protegida en el backend.
 */
const estadoInterno = ref<EstadoSesion>('verificando')

export const estadoSesion = readonly(estadoInterno)

let versionAutenticacion = 0

export function versionSesion(): number {
  return versionAutenticacion
}

export function marcarSesionNoConfirmada(): void {
  versionAutenticacion++
  estadoInterno.value = 'error'
}

/*
 * Avisa a las otras pestañas del mismo navegador que deben
 * comprobar de nuevo la sesión.
 *
 * No guarda contraseñas ni datos de la cuenta.
 */
function notificarOtrasPestanas(): void {
  try {
    localStorage.setItem(CLAVE_EVENTO_SESION, `${Date.now()}-${Math.random()}`)
  } catch {
    // El navegador puede tener deshabilitado el almacenamiento.
  }
}

export async function obtenerTokenCsrf(signal?: AbortSignal): Promise<TokenCsrf> {
  const respuesta = await solicitarApi<TokenCsrf>('/api/auth/csrf', {
    method: 'GET',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  })

  if (!respuesta || typeof respuesta.header !== 'string' || typeof respuesta.token !== 'string') {
    throw new Error('El servidor no entregó un token de seguridad válido.')
  }

  return respuesta
}

export async function iniciarSesion(
  correo: string,
  contrasena: string,
): Promise<SesionAdministrador> {
  const version = ++versionAutenticacion

  try {
    const csrf = await obtenerTokenCsrf()

    const respuesta = await solicitarApi<SesionAdministrador>('/api/auth/login', {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        [csrf.header]: csrf.token,
      },

      body: JSON.stringify({
        correo,
        contrasena,
      }),
    })

    if (version === versionAutenticacion) {
      estadoInterno.value = 'activa'
      notificarOtrasPestanas()
    }

    return respuesta
  } catch (error) {
    if (version === versionAutenticacion && estadoInterno.value !== 'activa') {
      estadoInterno.value =
        error instanceof ErrorApi && (error.estado === 401 || error.estado === 403)
          ? 'inactiva'
          : 'error'
    }

    throw error
  }
}

export async function consultarSesion(): Promise<SesionAdministrador> {
  const version = versionAutenticacion

  try {
    const respuesta = await solicitarApi<SesionAdministrador>('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
    })

    if (version === versionAutenticacion) {
      estadoInterno.value = 'activa'
    }

    return respuesta
  } catch (error) {
    if (version === versionAutenticacion) {
      if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 403)) {
        estadoInterno.value = 'inactiva'
      } else if (estadoInterno.value !== 'activa') {
        estadoInterno.value = 'error'
      }
    }

    throw error
  }
}

export async function cerrarSesion(signal?: AbortSignal): Promise<void> {
  const version = ++versionAutenticacion
  const csrf = await obtenerTokenCsrf(signal)

  await solicitarApi<void>('/api/auth/logout', {
    method: 'POST',

    headers: {
      [csrf.header]: csrf.token,
    },

    ...(signal ? { signal } : {}),
  })

  if (version === versionAutenticacion) {
    estadoInterno.value = 'inactiva'
    notificarOtrasPestanas()
  }
}
