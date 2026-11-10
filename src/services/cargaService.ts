import { solicitarApi } from './api'
import { obtenerTokenCsrf } from './authService'

import type { Carga, ErrorCarga } from '../types/carga'

export async function cargarArchivoComparacion(
  archivo: File,
  anio: number,
  trimestre: number,
): Promise<Carga> {
  const csrf = await obtenerTokenCsrf()

  const formulario = new FormData()

  formulario.append('archivo', archivo)
  formulario.append('anio', String(anio))
  formulario.append('trimestre', String(trimestre))

  return solicitarApi<Carga>('/api/admin/comparaciones/cargas', {
    method: 'POST',

    headers: {
      [csrf.header]: csrf.token,
    },

    body: formulario,
  })
}

export async function listarCargas(): Promise<Carga[]> {
  return solicitarApi<Carga[]>('/api/admin/cargas', {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function listarErroresCarga(cargaId: number): Promise<ErrorCarga[]> {
  return solicitarApi<ErrorCarga[]>(`/api/admin/cargas/${cargaId}/errores`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function publicarCarga(cargaId: number): Promise<Carga> {
  const csrf = await obtenerTokenCsrf()

  return solicitarApi<Carga>(`/api/admin/comparaciones/cargas/${cargaId}/publicar?confirmar=true`, {
    method: 'POST',

    headers: {
      [csrf.header]: csrf.token,
    },
  })
}
