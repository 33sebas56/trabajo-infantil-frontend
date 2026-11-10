import { solicitarApi } from './api'

export type Edad = 'TODAS' | '5_14' | '15_17'
export type Sexo = 'TODOS' | 'MASCULINO' | 'FEMENINO' | 'SIN_DATO'

export type Periodo = {
  id: number
  anio: number
  trimestre: number
}

export type FiltrosEstadisticas = {
  anio: number
  trimestre: number
  edad: Edad
  sexo: Sexo
}

export type Indicador = {
  codigo: string
  nombre: string
  unidad: string
  valor: number | null
  estado: string
  mensaje: string | null
  muestra: number | null
  versionRegla: string | null
}

export type ResumenEstadisticas = FiltrosEstadisticas & {
  estado: string
  mensaje: string | null
  cargaId: number | null
  indicadores: Indicador[]
}

export type PuntoEstadistica = {
  anio: number
  valor: number | null
  estado: string
  mensaje: string | null
  muestra: number | null
  versionRegla: string | null
}

export type ComparacionEstadisticas = {
  indicador: string
  nombre: string
  unidad: string
  trimestre: number
  edad: Edad
  sexo: Sexo
  puntos: PuntoEstadistica[]
}

export async function listarPeriodosPublicados(): Promise<Periodo[]> {
  return solicitarApi<Periodo[]>('/api/publico/periodos', {
    cache: 'no-store',
  })
}

export async function consultarEstadisticas(
  filtros: FiltrosEstadisticas,
): Promise<ResumenEstadisticas> {
  const parametros = new URLSearchParams({
    anio: String(filtros.anio),
    trimestre: String(filtros.trimestre),
    edad: filtros.edad,
    sexo: filtros.sexo,
  })

  return solicitarApi<ResumenEstadisticas>(`/api/publico/estadisticas?${parametros}`, {
    cache: 'no-store',
  })
}

export async function compararEstadisticas(
  filtros: FiltrosEstadisticas,
  indicador: string,
  desde: number,
  hasta: number,
  esAdministracion = false,
): Promise<ComparacionEstadisticas> {
  const parametros = new URLSearchParams({
    indicador,
    desde: String(desde),
    hasta: String(hasta),
    trimestre: String(filtros.trimestre),
    edad: filtros.edad,
    sexo: filtros.sexo,
  })

  const ruta = esAdministracion
    ? '/api/admin/estadisticas/comparacion'
    : '/api/publico/estadisticas/comparacion'

  return solicitarApi<ComparacionEstadisticas>(`${ruta}?${parametros}`, {
    cache: 'no-store',
  })
}

export function formatearValor(valor: number, unidad: string): string {
  if (unidad === 'PORCENTAJE') {
    if (valor > 0 && valor < 0.01) {
      return '< 0,01 %'
    }

    return `${new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 2,
    }).format(valor)} %`
  }

  const numero = new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(valor)

  if (unidad === 'PERSONAS') {
    return `${numero} personas`
  }

  if (unidad === 'COP_MENSUAL') {
    return `$ ${numero}`
  }

  return numero
}
