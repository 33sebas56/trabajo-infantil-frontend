export type PuntoComparacion = {
  anio: number
  cargaId: number | null
  valor: number | null
  cantidadMuestra: number | null
  estado: string
  mensaje: string | null
}

export type Comparacion = {
  codigoIndicador: string
  trimestre: number
  unidad: string
  versionRegla: string
  advertencia: string
  puntos: PuntoComparacion[]
}

export type ResultadoCarga = {
  id: number

  anio: number
  trimestre: number

  codigoIndicador: string
  nombreIndicador: string
  versionRegla: string
  unidad: string

  territorio: string
  criterioAgrupacion: string
  grupo: string

  valor: number | null
  numerador: number | null
  denominador: number | null
  cantidadMuestra: number | null

  motivoNoDisponible: string | null
  calculadoEn: string | null
}

export type FiltrosComparacion = {
  indicador: string
  desde: number
  hasta: number
  trimestre: number
}
