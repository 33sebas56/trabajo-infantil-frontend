import { solicitarApi } from './api'

import type { Comparacion, FiltrosComparacion, ResultadoCarga } from '../types/comparacion'

export async function consultarComparacion(
  filtros: FiltrosComparacion,
  esAdministracion: boolean,
): Promise<Comparacion> {
  const parametros = new URLSearchParams({
    indicador: filtros.indicador,
    desde: String(filtros.desde),
    hasta: String(filtros.hasta),
    trimestre: String(filtros.trimestre),
  })

  const rutaBase = esAdministracion ? '/api/admin/comparaciones' : '/api/publico/comparaciones'

  return solicitarApi<Comparacion>(`${rutaBase}?${parametros.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  })
}

export async function consultarResultadosCarga(cargaId: number): Promise<ResultadoCarga[]> {
  return solicitarApi<ResultadoCarga[]>(`/api/admin/cargas/${cargaId}/resultados`, {
    method: 'GET',
    cache: 'no-store',
  })
}
