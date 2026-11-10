export type Carga = {
  id: number
  periodoId: number | null

  anio: number
  trimestre: number

  nombreArchivo: string
  estado: string
  vigente: boolean

  registrosTotales: number | null
  registrosPasto: number | null
  registrosValidos: number | null
  registrosInvalidos: number | null

  mensajeResultado: string | null

  iniciadoEn: string | null
  finalizadoEn: string | null
}

export type ErrorCarga = {
  id: number
  cargaId: number

  numeroFila: number | null
  campo: string | null
  detalle: string

  creadoEn: string | null
}
