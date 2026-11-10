<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { ErrorApi } from '../services/api'
import { cerrarSesion, consultarSesion, type SesionAdministrador } from '../services/authService'

import {
  cargarArchivoComparacion,
  listarCargas,
  listarErroresCarga,
  publicarCarga,
} from '../services/cargaService'

import { consultarResultadosCarga } from '../services/comparacionService'

import type { Carga, ErrorCarga } from '../types/carga'
import type { ResultadoCarga } from '../types/comparacion'

type PeriodoArchivo = {
  anio: number
  trimestre: number
}

const router = useRouter()

/* ============================================================
   SESIÓN ADMINISTRATIVA
============================================================ */

const administrador = ref<SesionAdministrador | null>(null)

const verificandoSesion = ref(true)
const cerrandoSesion = ref(false)
const requiereSesion = ref(false)

const mensajeSesion = ref('')

/* ============================================================
   UN ARCHIVO POR CARGA
============================================================ */

const archivoSeleccionado = ref<File | null>(null)
const inputArchivo = ref<HTMLInputElement | null>(null)

const anio = ref<number | ''>('')
const trimestre = ref<number | ''>('')

const periodoDetectado = ref<PeriodoArchivo | null>(null)
const periodoConfirmado = ref(false)

const procesando = ref(false)
const mensajeCarga = ref('')

/* ============================================================
   HISTORIAL Y DETALLE
============================================================ */

const cargas = ref<Carga[]>([])
const cargandoHistorial = ref(false)
const mensajeHistorial = ref('')

const seleccionada = ref<Carga | null>(null)

const resultados = ref<ResultadoCarga[]>([])
const errores = ref<ErrorCarga[]>([])

const grupoResultados = ref('GENERAL')

const cargandoDetalle = ref(false)
const publicando = ref(false)

const mensajeResultados = ref('')
const mensajeErrores = ref('')
const mensajePublicacion = ref('')

let numeroRevision = 0

const cargasOrdenadas = computed(() => {
  return [...cargas.value].sort((a, b) => b.id - a.id)
})

const resumenGestion = computed(() => ({
  total: cargas.value.length,

  vigentes: cargas.value.filter((carga) => carga.vigente).length,

  validadas: cargas.value.filter((carga) => {
    return carga.estado === 'VALIDADA' && !carga.vigente
  }).length,
}))

const resultadosVisibles = computed(() => {
  if (grupoResultados.value === 'TODOS') {
    return resultados.value
  }

  return resultados.value.filter((resultado) => {
    return resultado.criterioAgrupacion === grupoResultados.value
  })
})

/* ============================================================
   FUNCIONES GENERALES
============================================================ */

function textoError(error: unknown, alternativo: string): string {
  return error instanceof Error ? error.message : alternativo
}

function esCarga(datos: unknown): datos is Carga {
  if (typeof datos !== 'object' || datos === null) {
    return false
  }

  const posible = datos as Record<string, unknown>

  return typeof posible.id === 'number' && typeof posible.estado === 'string'
}

function mensajeVisible(mensaje: string | null | undefined): string {
  if (!mensaje) {
    return ''
  }

  return mensaje
    .replace(/resultados exploratorios/gi, 'resultados')
    .replace(/resultado exploratorio/gi, 'resultado')
}

function cantidad(valor: number | null | undefined, decimales = 0): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return 'No disponible'
  }

  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: decimales,
  }).format(valor)
}

function nombreEstado(estado: string): string {
  const nombres: Record<string, string> = {
    RECIBIDA: 'Recibida',
    VALIDANDO: 'Validando',
    VALIDADA: 'Validada',
    PROCESANDO: 'Procesando',
    COMPLETADA: 'Procesada',
    FALLIDA: 'Con errores',
  }

  return nombres[estado] ?? estado
}

function claseEstado(estado: string): string {
  if (estado === 'FALLIDA') {
    return 'estado--error'
  }

  if (estado === 'VALIDADA' || estado === 'COMPLETADA') {
    return 'estado--correcto'
  }

  return 'estado--pendiente'
}

/* ============================================================
   PERIODO DEL ARCHIVO
============================================================ */

/*
 * Reconoce nombres que incluyen un periodo como:
 *
 * total_tri_4_2025_pl.CSV
 *
 * Si el nombre no contiene ese formato, el administrador
 * puede indicar el periodo manualmente.
 */
function detectarPeriodoEnNombre(nombre: string): PeriodoArchivo | null {
  const patron = /(?:^|[_\s-])tri(?:mestre)?[_\s-]*([1-4])[_\s-]+((?:19|20|21)\d{2})(?=[_\s.-]|$)/i

  const coincidencia = nombre.match(patron)

  if (!coincidencia) {
    return null
  }

  const trimestreDetectado = Number(coincidencia[1])
  const anioDetectado = Number(coincidencia[2])

  if (!Number.isInteger(trimestreDetectado) || !Number.isInteger(anioDetectado)) {
    return null
  }

  return {
    anio: anioDetectado,
    trimestre: trimestreDetectado,
  }
}

function alertaPeriodo(carga: Carga): string {
  const periodoNombre = detectarPeriodoEnNombre(carga.nombreArchivo)

  if (!periodoNombre) {
    return ''
  }

  if (periodoNombre.anio !== carga.anio || periodoNombre.trimestre !== carga.trimestre) {
    return (
      'El nombre indica ' +
      periodoNombre.anio +
      ', trimestre ' +
      periodoNombre.trimestre +
      ', pero la carga se registró como ' +
      carga.anio +
      ', trimestre ' +
      carga.trimestre +
      '.'
    )
  }

  return ''
}

/* ============================================================
   CONSULTAR Y CERRAR SESIÓN
============================================================ */

async function cargarSesion(): Promise<void> {
  verificandoSesion.value = true
  mensajeSesion.value = ''
  requiereSesion.value = false

  try {
    administrador.value = await consultarSesion()
    await actualizarHistorial()
  } catch (error) {
    administrador.value = null

    if (error instanceof ErrorApi && (error.estado === 401 || error.estado === 403)) {
      requiereSesion.value = true

      mensajeSesion.value = 'Inicia sesión como administrador para entrar a esta sección.'
    } else {
      mensajeSesion.value = textoError(error, 'No fue posible consultar la sesión.')
    }
  } finally {
    verificandoSesion.value = false
  }
}

async function salir(): Promise<void> {
  if (cerrandoSesion.value || procesando.value || publicando.value) {
    return
  }

  cerrandoSesion.value = true
  mensajeSesion.value = ''

  try {
    await cerrarSesion()

    administrador.value = null

    await router.push({
      name: 'inicio',
    })
  } catch (error) {
    mensajeSesion.value = textoError(error, 'No fue posible cerrar la sesión.')
  } finally {
    cerrandoSesion.value = false
  }
}

/* ============================================================
   HISTORIAL
============================================================ */

async function actualizarHistorial(): Promise<void> {
  cargandoHistorial.value = true
  mensajeHistorial.value = ''

  try {
    cargas.value = await listarCargas()
  } catch (error) {
    mensajeHistorial.value = textoError(error, 'No fue posible consultar el historial.')
  } finally {
    cargandoHistorial.value = false
  }
}

/* ============================================================
   SELECCIÓN Y CARGA DEL ARCHIVO
============================================================ */

function seleccionarArchivo(evento: Event): void {
  const input = evento.target as HTMLInputElement
  const archivo = input.files?.[0] ?? null

  archivoSeleccionado.value = null
  periodoDetectado.value = null

  anio.value = ''
  trimestre.value = ''

  periodoConfirmado.value = false
  mensajeCarga.value = ''

  if (!archivo) {
    return
  }

  if (!archivo.name.toLowerCase().endsWith('.csv')) {
    mensajeCarga.value = 'Selecciona un archivo con extensión CSV.'
    input.value = ''
    return
  }

  archivoSeleccionado.value = archivo

  const periodo = detectarPeriodoEnNombre(archivo.name)

  if (periodo) {
    periodoDetectado.value = periodo
    anio.value = periodo.anio
    trimestre.value = periodo.trimestre
  }
}

function quitarArchivo(): void {
  if (procesando.value) {
    return
  }

  archivoSeleccionado.value = null
  periodoDetectado.value = null

  anio.value = ''
  trimestre.value = ''

  periodoConfirmado.value = false
  mensajeCarga.value = ''

  if (inputArchivo.value) {
    inputArchivo.value.value = ''
  }
}

function periodoValido(): boolean {
  return (
    typeof anio.value === 'number' &&
    Number.isInteger(anio.value) &&
    anio.value >= 1900 &&
    anio.value <= 2100 &&
    typeof trimestre.value === 'number' &&
    Number.isInteger(trimestre.value) &&
    trimestre.value >= 1 &&
    trimestre.value <= 4
  )
}

async function procesarArchivo(): Promise<void> {
  if (procesando.value || publicando.value) {
    return
  }

  mensajeCarga.value = ''

  const archivo = archivoSeleccionado.value
  const anioSolicitado = anio.value
  const trimestreSolicitado = trimestre.value

  if (!archivo) {
    mensajeCarga.value = 'Selecciona un archivo CSV.'
    return
  }

  if (
    !periodoValido() ||
    typeof anioSolicitado !== 'number' ||
    typeof trimestreSolicitado !== 'number'
  ) {
    mensajeCarga.value = 'Indica un año y trimestre válidos para el archivo.'

    return
  }

  if (!periodoConfirmado.value) {
    mensajeCarga.value = 'Confirma que revisaste el periodo antes de continuar.'

    return
  }

  const existe = cargas.value.some((carga) => {
    return carga.anio === anioSolicitado && carga.trimestre === trimestreSolicitado
  })

  if (existe) {
    const continuar = window.confirm(
      'Ya existe una carga para ' +
        anioSolicitado +
        ', trimestre ' +
        trimestreSolicitado +
        '.\n\nSi continúas, se registrará otra carga para revisión. ' +
        'La carga existente no se borrará ni se reemplazará automáticamente.' +
        '\n\n¿Deseas continuar?',
    )

    if (!continuar) {
      return
    }
  }

  procesando.value = true

  try {
    const respuesta = await cargarArchivoComparacion(archivo, anioSolicitado, trimestreSolicitado)

    mensajeCarga.value =
      mensajeVisible(respuesta.mensajeResultado) || 'El archivo terminó de procesarse.'

    archivoSeleccionado.value = null
    periodoDetectado.value = null

    anio.value = ''
    trimestre.value = ''
    periodoConfirmado.value = false

    if (inputArchivo.value) {
      inputArchivo.value.value = ''
    }

    await actualizarHistorial()
    await revisarCarga(respuesta)
  } catch (error) {
    /*
     * Si el backend devuelve la carga con errores,
     * la mostramos para que pueda revisarse.
     */
    if (error instanceof ErrorApi && error.estado === 422 && esCarga(error.datos)) {
      mensajeCarga.value =
        mensajeVisible(error.datos.mensajeResultado) || 'La carga terminó con errores.'

      await actualizarHistorial()
      await revisarCarga(error.datos)
    } else {
      mensajeCarga.value =
        textoError(error, 'No fue posible confirmar el resultado de la carga.') +
        ' Revisa el historial antes de intentar enviarla nuevamente.'

      await actualizarHistorial()
    }
  } finally {
    procesando.value = false
  }
}

/* ============================================================
   REVISIÓN DE UNA CARGA
============================================================ */

async function revisarCarga(carga: Carga): Promise<void> {
  const revision = ++numeroRevision

  seleccionada.value = carga
  grupoResultados.value = 'GENERAL'

  resultados.value = []
  errores.value = []

  mensajeResultados.value = ''
  mensajeErrores.value = ''
  mensajePublicacion.value = ''

  cargandoDetalle.value = true

  const [respuestaResultados, respuestaErrores] = await Promise.allSettled([
    consultarResultadosCarga(carga.id),
    listarErroresCarga(carga.id),
  ] as const)

  if (revision !== numeroRevision) {
    return
  }

  if (respuestaResultados.status === 'fulfilled') {
    resultados.value = respuestaResultados.value
  } else {
    mensajeResultados.value = textoError(
      respuestaResultados.reason,
      'No fue posible consultar los resultados.',
    )
  }

  if (respuestaErrores.status === 'fulfilled') {
    errores.value = respuestaErrores.value
  } else {
    mensajeErrores.value = textoError(
      respuestaErrores.reason,
      'No fue posible consultar los errores.',
    )
  }

  cargandoDetalle.value = false
}

/* ============================================================
   PRESENTACIÓN DE RESULTADOS
============================================================ */

function nombreIndicador(resultado: ResultadoCarga): string {
  if (resultado.codigoIndicador === 'POBLACION_EXPANDIDA_5_17') {
    return 'Población estimada'
  }

  if (resultado.codigoIndicador === 'RESPUESTAS_AFIRMATIVAS_TRABAJO') {
    return 'Respuestas afirmativas sobre actividad laboral'
  }

  return resultado.nombreIndicador
}

function nombreGrupo(resultado: ResultadoCarga): string {
  const nombres: Record<string, string> = {
    TOTAL: 'Total',

    '5_14': '5 a 14 años',
    '15_17': '15 a 17 años',

    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    SIN_DATO: 'Sin dato de sexo',

    '5_14_MASCULINO': '5 a 14 años · Masculino',
    '5_14_FEMENINO': '5 a 14 años · Femenino',
    '5_14_SIN_DATO': '5 a 14 años · Sin dato de sexo',

    '15_17_MASCULINO': '15 a 17 años · Masculino',
    '15_17_FEMENINO': '15 a 17 años · Femenino',
    '15_17_SIN_DATO': '15 a 17 años · Sin dato de sexo',
  }

  return nombres[resultado.grupo] ?? resultado.grupo
}

function valorResultado(resultado: ResultadoCarga): string {
  const valor = resultado.valor

  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return 'No disponible'
  }

  const unidad = resultado.unidad.toUpperCase()

  if (unidad === 'PERSONAS') {
    return '≈ ' + cantidad(valor) + ' personas estimadas'
  }

  if (unidad === 'PORCENTAJE') {
    if (valor > 0 && valor < 0.01) {
      return '< 0,01 %'
    }

    return cantidad(valor, 2) + ' %'
  }

  if (unidad === 'COP_MENSUAL') {
    return '$ ' + cantidad(valor) + ' / mes'
  }

  return unidad ? cantidad(valor, 4) + ' ' + resultado.unidad : cantidad(valor, 4)
}

function esResultadoGeneral(resultado: ResultadoCarga): boolean {
  return resultado.criterioAgrupacion === 'GENERAL' && resultado.grupo === 'TOTAL'
}

const resultadoPoblacion = computed(() => {
  return (
    resultados.value.find((resultado) => {
      return (
        resultado.codigoIndicador === 'POBLACION_EXPANDIDA_5_17' && esResultadoGeneral(resultado)
      )
    }) ?? null
  )
})

const resultadoTrabajo = computed(() => {
  return (
    resultados.value.find((resultado) => {
      return (
        resultado.codigoIndicador === 'RESPUESTAS_AFIRMATIVAS_TRABAJO' &&
        esResultadoGeneral(resultado)
      )
    }) ?? null
  )
})

const porcentajeBarra = computed<number | null>(() => {
  const valor = resultadoTrabajo.value?.valor

  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100) {
    return null
  }

  return valor
})

const alertaPeriodoSeleccionado = computed(() => {
  return seleccionada.value ? alertaPeriodo(seleccionada.value) : ''
})

/* ============================================================
   PUBLICACIÓN
============================================================ */

/*
 * La publicación siempre requiere revisión y confirmación.
 * El backend también verifica si la carga puede publicarse.
 */
function versionComparable(carga: Carga, version: string | null): boolean {
  if (carga.trimestre !== 4 || carga.anio < 2022 || carga.anio > 2025) return false

  return version === 'EXP-COMUN-1' || (carga.anio === 2022 && version === 'REV-2022-T4')
}

function versionPublicable(carga: Carga, version: string | null): boolean {
  if (carga.anio < 2022 || carga.trimestre < 1 || carga.trimestre > 4) return false

  return versionComparable(carga, version) || version === `REV-${carga.anio}-T${carga.trimestre}`
}

const puedePublicar = computed(() => {
  const carga = seleccionada.value

  if (
    !carga ||
    carga.vigente ||
    cargandoDetalle.value ||
    mensajeResultados.value ||
    mensajeErrores.value ||
    alertaPeriodoSeleccionado.value ||
    resultados.value.length === 0
  ) {
    return false
  }

  const estadoPermitido = carga.estado === 'VALIDADA' || carga.estado === 'COMPLETADA'

  const versionAdmitida = resultados.value.every((resultado) => {
    return versionPublicable(carga, resultado.versionRegla)
  })

  const hayAlgunValor = resultados.value.some((resultado) => {
    return typeof resultado.valor === 'number' && Number.isFinite(resultado.valor)
  })

  return estadoPermitido && versionAdmitida && hayAlgunValor
})

const advertenciaComparacion = computed(() => {
  const carga = seleccionada.value
  if (!carga || resultados.value.length === 0) return ''

  const requiereRevision = resultados.value.some((resultado) => {
    return !versionComparable(carga, resultado.versionRegla)
  })
  return requiereRevision
    ? 'Revisa las preguntas y los resultados de este periodo. La comparación con otros años estará pendiente de revisión.'
    : ''
})

const mensajeDetalleCarga = computed(() => {
  const carga = seleccionada.value
  if (!carga) return ''

  const mensaje = mensajeVisible(carga.mensajeResultado)
  const avisoAnterior = 'Este periodo requiere revisión antes de compararse o publicarse.'
  if (
    carga.anio === 2022 &&
    carga.trimestre === 4 &&
    puedePublicar.value &&
    mensaje.includes(avisoAnterior)
  ) {
    return 'El archivo está validado. Revisa sus resultados antes de publicar la carga.'
  }
  return mensaje
})

// Explica por qué la carga seleccionada todavía no se puede publicar.
const motivoPublicacion = computed(() => {
  const carga = seleccionada.value

  if (!carga) return 'Selecciona una carga en el historial.'
  if (carga.vigente) return 'Esta carga ya está publicada y vigente.'
  if (cargandoDetalle.value) return 'Consultando los resultados de la carga...'
  if (mensajeResultados.value || mensajeErrores.value) {
    return 'No fue posible consultar todos los datos necesarios para publicar. Vuelve a revisar la carga.'
  }
  if (alertaPeriodoSeleccionado.value) {
    return 'El periodo registrado no coincide con el nombre del archivo. Revisa la carga.'
  }
  if (carga.estado !== 'VALIDADA' && carga.estado !== 'COMPLETADA') {
    return 'La carga debe estar validada antes de poder publicarse.'
  }
  if (resultados.value.length === 0) return 'Esta carga todavía no tiene resultados disponibles.'
  if (resultados.value.some((resultado) => !versionPublicable(carga, resultado.versionRegla))) {
    return 'La versión de los resultados no corresponde a un periodo habilitado para publicar.'
  }
  if (
    !resultados.value.some(
      (resultado) => typeof resultado.valor === 'number' && Number.isFinite(resultado.valor),
    )
  ) {
    return 'La carga no tiene resultados numéricos disponibles para publicar.'
  }

  return ''
})

async function confirmarPublicacion(): Promise<void> {
  const carga = seleccionada.value

  if (!carga || !puedePublicar.value || publicando.value || procesando.value) {
    return
  }

  const confirmado = window.confirm(
    '¿Deseas publicar la carga #' +
      carga.id +
      '?\n\nPeriodo: ' +
      carga.anio +
      ', trimestre ' +
      carga.trimestre +
      '.\n\nComprueba el archivo y sus resultados. ' +
      'Esta acción puede reemplazar la carga vigente del mismo periodo.' +
      (advertenciaComparacion.value ? '\n\n' + advertenciaComparacion.value : ''),
  )

  if (!confirmado) {
    return
  }

  publicando.value = true
  mensajePublicacion.value = ''

  try {
    const respuesta = await publicarCarga(carga.id)

    seleccionada.value = respuesta

    mensajePublicacion.value =
      mensajeVisible(respuesta.mensajeResultado) || 'La solicitud de publicación terminó.'

    await actualizarHistorial()
  } catch (error) {
    mensajePublicacion.value = textoError(error, 'No fue posible publicar la carga.')
  } finally {
    publicando.value = false
  }
}

onMounted(() => {
  void cargarSesion()
})
</script>

<template>
  <div class="administracion">
    <!-- Encabezado -->

    <header class="barra">
      <div class="barra__contenido">
        <RouterLink class="marca" to="/" aria-label="Ir al inicio">
          <span class="marca__simbolo" aria-hidden="true"> P </span>

          <span>
            <strong>Trabajo <span class="marca-amarilla">Infantil</span></strong>
            <small>Administración del sistema</small>
          </span>
        </RouterLink>

        <nav class="barra__acciones" aria-label="Navegación de administración">
          <RouterLink class="barra__enlace" to="/"> Ver sitio público </RouterLink>

          <button
            v-if="administrador"
            class="boton-salir"
            type="button"
            :disabled="cerrandoSesion || procesando || publicando"
            @click="salir"
          >
            {{ cerrandoSesion ? 'Cerrando...' : 'Cerrar sesión' }}
          </button>
        </nav>
      </div>
    </header>

    <main class="contenido">
      <!-- Verificación de sesión -->

      <section v-if="verificandoSesion" class="panel" role="status">
        Verificando la sesión...
      </section>

      <section v-else-if="!administrador" class="panel">
        <h1>Acceso administrativo</h1>

        <p class="nota" role="alert">
          {{ mensajeSesion }}
        </p>

        <RouterLink v-if="requiereSesion" class="boton boton--principal" :to="{ name: 'ingresar' }">
          Ir al inicio de sesión
        </RouterLink>

        <button v-else class="boton boton--principal" type="button" @click="cargarSesion">
          Volver a intentar
        </button>
      </section>

      <template v-else>
        <!-- Presentación y resumen -->

        <section class="presentacion">
          <span class="etiqueta">Zona administrativa</span>

          <h1>Gestión de información</h1>

          <p>
            Bienvenido, <strong>{{ administrador.nombre }}</strong
            >. Carga archivos, revisa sus resultados y administra su publicación.
          </p>

          <div v-if="!cargandoHistorial && !mensajeHistorial" class="resumen-gestion">
            <div>
              <strong>{{ resumenGestion.total }}</strong>
              <span>Cargas registradas</span>
            </div>

            <div>
              <strong>{{ resumenGestion.vigentes }}</strong>
              <span>Cargas vigentes</span>
            </div>

            <div>
              <strong>{{ resumenGestion.validadas }}</strong>
              <span>Validadas sin publicar</span>
            </div>
          </div>
        </section>

        <p v-if="mensajeSesion" class="mensaje mensaje--error" role="alert">
          {{ mensajeSesion }}
        </p>

        <div
          class="zona-administrativa"
          :class="{ 'zona-administrativa--completa': !seleccionada }"
        >
          <div class="columna-administrativa">
            <!-- Cargar archivo -->

            <section class="panel" aria-labelledby="titulo-carga">
              <div class="titulo-panel">
                <span class="numero" aria-hidden="true">01</span>

                <div>
                  <h2 id="titulo-carga">Cargar archivo de datos</h2>

                  <p>Selecciona un archivo CSV para agregar un periodo al sistema.</p>
                </div>
              </div>

              <form @submit.prevent="procesarArchivo">
                <div class="selector-archivo">
                  <span class="selector-archivo__icono" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 16V4m0 0L8 8m4-4 4 4M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </span>

                  <div>
                    <strong>Selecciona un archivo CSV</strong>

                    <p>Puedes buscarlo en tu equipo y revisar su periodo antes de procesarlo.</p>

                    <input
                      id="archivo-csv"
                      ref="inputArchivo"
                      class="input-archivo"
                      type="file"
                      accept=".csv,text/csv"
                      :disabled="procesando || publicando"
                      @change="seleccionarArchivo"
                    />

                    <label for="archivo-csv" class="boton boton--secundario">
                      Seleccionar archivo
                    </label>
                  </div>
                </div>

                <!-- Archivo elegido -->

                <div v-if="archivoSeleccionado" class="archivo-elegido">
                  <div class="archivo-elegido__superior">
                    <div class="archivo-elegido__nombre">
                      <span class="archivo-icono" aria-hidden="true"> CSV </span>

                      <div>
                        <small>Archivo seleccionado</small>
                        <strong>{{ archivoSeleccionado.name }}</strong>
                      </div>
                    </div>

                    <button
                      class="boton-texto"
                      type="button"
                      :disabled="procesando"
                      @click="quitarArchivo"
                    >
                      Quitar
                    </button>
                  </div>

                  <div v-if="periodoDetectado" class="periodo">
                    <span>Periodo propuesto por el nombre</span>
                    <strong>{{ anio }} · Trimestre {{ trimestre }}</strong>
                  </div>

                  <div v-else class="periodo-manual">
                    <p>
                      No se reconoció el periodo en el nombre. Indícalo según la fuente del archivo.
                    </p>

                    <div class="periodo-manual__campos">
                      <label>
                        Año

                        <input
                          v-model.number="anio"
                          type="number"
                          min="1900"
                          max="2100"
                          step="1"
                          :disabled="procesando"
                        />
                      </label>

                      <label>
                        Trimestre

                        <select v-model.number="trimestre" :disabled="procesando">
                          <option value="">Seleccionar</option>
                          <option :value="1">Primer trimestre</option>
                          <option :value="2">Segundo trimestre</option>
                          <option :value="3">Tercer trimestre</option>
                          <option :value="4">Cuarto trimestre</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <label class="confirmacion">
                    <input v-model="periodoConfirmado" type="checkbox" :disabled="procesando" />

                    <span> Revisé que el archivo corresponde al año y trimestre indicados. </span>
                  </label>

                  <button
                    class="boton boton--principal"
                    type="submit"
                    :disabled="procesando || publicando"
                  >
                    {{ procesando ? 'Procesando archivo...' : 'Cargar y procesar' }}
                  </button>

                  <p class="nota">
                    La carga se guarda para revisión y no se publica automáticamente.
                  </p>
                </div>
              </form>

              <p v-if="mensajeCarga" class="mensaje" role="status">
                {{ mensajeCarga }}
              </p>
            </section>

            <!-- Publicación de la carga seleccionada -->

            <section v-if="seleccionada" class="panel" aria-labelledby="titulo-publicacion">
              <div class="titulo-panel">
                <span class="numero" aria-hidden="true">✓</span>
                <div>
                  <h2 id="titulo-publicacion">Publicación</h2>
                  <p>Revisa los resultados antes de publicarlos.</p>
                </div>
              </div>

              <p class="nota">
                Carga #{{ seleccionada.id }} · {{ seleccionada.nombreArchivo }} ·
                {{ seleccionada.anio }} · Trimestre {{ seleccionada.trimestre }}
              </p>

              <button
                v-if="puedePublicar"
                class="boton boton--principal"
                type="button"
                :disabled="publicando || procesando"
                @click="confirmarPublicacion"
              >
                {{ publicando ? 'Publicando...' : 'Publicar esta carga' }}
              </button>

              <p v-else class="nota" role="status">{{ motivoPublicacion }}</p>

              <p v-if="puedePublicar && advertenciaComparacion" class="mensaje" role="status">
                {{ advertenciaComparacion }}
              </p>

              <p v-if="mensajePublicacion" class="mensaje" role="status">
                {{ mensajePublicacion }}
              </p>
            </section>

            <!-- Historial -->

            <section class="panel" aria-labelledby="titulo-historial">
              <div class="titulo-panel titulo-panel--separado">
                <div class="titulo-panel">
                  <span class="numero" aria-hidden="true">02</span>

                  <div>
                    <h2 id="titulo-historial">Historial de cargas</h2>
                    <p>Selecciona una carga para revisar sus resultados.</p>
                  </div>
                </div>

                <button
                  class="boton boton--secundario"
                  type="button"
                  :disabled="cargandoHistorial || procesando"
                  @click="actualizarHistorial"
                >
                  {{ cargandoHistorial ? 'Actualizando...' : 'Actualizar' }}
                </button>
              </div>

              <p v-if="mensajeHistorial" class="mensaje mensaje--error" role="alert">
                {{ mensajeHistorial }}
              </p>

              <p v-if="cargandoHistorial" class="nota" role="status">Consultando historial...</p>

              <p v-else-if="cargasOrdenadas.length === 0 && !mensajeHistorial" class="nota">
                Todavía no hay cargas registradas.
              </p>

              <div v-else-if="cargasOrdenadas.length > 0" class="tabla-contenedor">
                <table>
                  <caption>
                    Archivos registrados
                  </caption>

                  <thead>
                    <tr>
                      <th scope="col">Archivo</th>
                      <th scope="col">Periodo</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Publicado</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr v-for="carga in cargasOrdenadas" :key="carga.id">
                      <td>
                        <strong>{{ carga.nombreArchivo }}</strong>

                        <small class="tabla-secundario"> Carga #{{ carga.id }} </small>
                      </td>

                      <td>
                        {{ carga.anio }} · T{{ carga.trimestre }}

                        <span v-if="alertaPeriodo(carga)" class="aviso-periodo">
                          Revisar periodo
                        </span>
                      </td>

                      <td>
                        <span class="estado" :class="claseEstado(carga.estado)">
                          {{ nombreEstado(carga.estado) }}
                        </span>
                      </td>

                      <td>{{ carga.vigente ? 'Sí' : 'No' }}</td>

                      <td>
                        <button
                          class="boton-texto"
                          type="button"
                          :disabled="procesando || publicando"
                          :aria-pressed="seleccionada?.id === carga.id"
                          @click="revisarCarga(carga)"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <!-- Detalle de la carga -->

          <section v-if="seleccionada" class="panel" aria-labelledby="titulo-detalle">
            <div class="titulo-panel">
              <span class="numero" aria-hidden="true">03</span>

              <div>
                <h2 id="titulo-detalle">Detalle de la carga #{{ seleccionada.id }}</h2>

                <p>
                  {{ seleccionada.nombreArchivo }} · {{ seleccionada.anio }} · Trimestre
                  {{ seleccionada.trimestre }}
                </p>
              </div>
            </div>

            <p v-if="alertaPeriodoSeleccionado" class="mensaje mensaje--error" role="alert">
              {{ alertaPeriodoSeleccionado }}
              Revisa esta carga antes de publicarla.
            </p>

            <div class="resumen">
              <div>
                <span>Estado</span>
                <strong>{{ nombreEstado(seleccionada.estado) }}</strong>
              </div>

              <div>
                <span>Publicado y vigente</span>
                <strong>{{ seleccionada.vigente ? 'Sí' : 'No' }}</strong>
              </div>

              <div>
                <span>Registros totales</span>
                <strong>{{ cantidad(seleccionada.registrosTotales) }}</strong>
              </div>

              <div>
                <span>Registros de Pasto</span>
                <strong>{{ cantidad(seleccionada.registrosPasto) }}</strong>
              </div>

              <div>
                <span>Registros válidos</span>
                <strong>{{ cantidad(seleccionada.registrosValidos) }}</strong>
              </div>

              <div>
                <span>Registros inválidos</span>
                <strong>{{ cantidad(seleccionada.registrosInvalidos) }}</strong>
              </div>
            </div>

            <p v-if="mensajeDetalleCarga" class="mensaje">
              {{ mensajeDetalleCarga }}
            </p>

            <p v-if="cargandoDetalle" class="nota" role="status">
              Consultando resultados y errores...
            </p>

            <template v-else>
              <!-- Resultados -->

              <div class="encabezado-resultados">
                <span class="subtitulo">Información del periodo</span>
                <h3>Resultados de la carga</h3>
              </div>

              <p v-if="mensajeResultados" class="mensaje mensaje--error" role="alert">
                {{ mensajeResultados }}
              </p>

              <p v-else-if="resultados.length === 0" class="nota">
                No hay resultados disponibles para esta carga.
              </p>

              <template v-else>
                <div class="indicadores">
                  <article class="indicador">
                    <span>Población de 5 a 17 años</span>

                    <strong>
                      {{
                        resultadoPoblacion ? valorResultado(resultadoPoblacion) : 'No disponible'
                      }}
                    </strong>

                    <p>Población estimada a partir de los registros y sus factores de expansión.</p>

                    <small v-if="resultadoPoblacion && resultadoPoblacion.cantidadMuestra !== null">
                      Muestra:
                      {{ cantidad(resultadoPoblacion.cantidadMuestra) }}
                      registros
                    </small>
                  </article>

                  <article class="indicador">
                    <span> Respuestas afirmativas sobre actividad laboral </span>

                    <strong>
                      {{ resultadoTrabajo ? valorResultado(resultadoTrabajo) : 'No disponible' }}
                    </strong>

                    <p>Porcentaje calculado con las respuestas seleccionadas de la encuesta.</p>

                    <div v-if="porcentajeBarra !== null" class="indicador__grafica">
                      <progress
                        :value="porcentajeBarra"
                        max="100"
                        aria-label="Porcentaje de respuestas afirmativas sobre actividad laboral"
                      >
                        {{ porcentajeBarra }} %
                      </progress>

                      <div class="indicador__escala">
                        <span>0 %</span>
                        <span>100 %</span>
                      </div>
                    </div>
                  </article>
                </div>

                <p class="nota">
                  La población se muestra redondeada. Los valores guardados no se modifican.
                </p>

                <!-- Filtro de resultados -->

                <div class="filtro-resultados">
                  <label for="grupo-resultados"> Mostrar resultados </label>

                  <select id="grupo-resultados" v-model="grupoResultados">
                    <option value="GENERAL">General</option>
                    <option value="EDAD">Por edad</option>
                    <option value="SEXO">Por sexo</option>
                    <option value="EDAD_SEXO">Por edad y sexo</option>
                    <option value="TODOS">Todos los grupos</option>
                  </select>
                </div>

                <p v-if="resultadosVisibles.length === 0" class="nota">
                  No hay resultados disponibles para este grupo.
                </p>

                <div v-else class="tabla-contenedor">
                  <table>
                    <caption>
                      Detalle de indicadores
                    </caption>

                    <thead>
                      <tr>
                        <th scope="col">Indicador</th>
                        <th scope="col">Grupo</th>
                        <th scope="col">Resultado</th>
                        <th scope="col">Muestra</th>
                        <th scope="col">Observación</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr v-for="resultado in resultadosVisibles" :key="resultado.id">
                        <td>{{ nombreIndicador(resultado) }}</td>
                        <td>{{ nombreGrupo(resultado) }}</td>
                        <td>{{ valorResultado(resultado) }}</td>
                        <td>{{ cantidad(resultado.cantidadMuestra) }}</td>

                        <td>
                          {{ mensajeVisible(resultado.motivoNoDisponible) || '—' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <details class="detalles">
                  <summary>Ver información técnica</summary>

                  <ul>
                    <li v-for="resultado in resultados" :key="resultado.id">
                      {{ nombreIndicador(resultado) }}: versión {{ resultado.versionRegla }}; valor
                      guardado {{ cantidad(resultado.valor, 4) }}.
                    </li>
                  </ul>
                </details>
              </template>

              <!-- Errores -->

              <h3 class="titulo-apartado">Errores registrados</h3>

              <p v-if="mensajeErrores" class="mensaje mensaje--error" role="alert">
                {{ mensajeErrores }}
              </p>

              <p v-else-if="errores.length === 0" class="nota">
                No hay errores registrados para esta carga.
              </p>

              <div v-else class="tabla-contenedor">
                <table>
                  <caption>
                    Errores de la carga
                  </caption>

                  <thead>
                    <tr>
                      <th scope="col">Fila</th>
                      <th scope="col">Campo</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr v-for="error in errores" :key="error.id">
                      <td>{{ error.numeroFila ?? 'No especificada' }}</td>
                      <td>{{ error.campo || 'No especificado' }}</td>
                      <td>{{ error.detalle }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </section>
        </div>
      </template>
    </main>

    <footer class="pie">
      <div>Información estadística de Pasto · Fuente: DANE</div>
    </footer>
  </div>
</template>

<style scoped>
.administracion {
  min-height: 100vh;
  background: #f5f6fa;
  color: #252b3c;
}

.barra {
  background: #292e69;
  color: white;
}

.barra__contenido,
.contenido,
.pie > div {
  width: min(1200px, calc(100% - 3rem));
  margin-inline: auto;
}

.barra__contenido {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.marca {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: white;
  text-decoration: none;
}

.marca strong,
.marca small {
  display: block;
}

.marca small {
  margin-top: 0.18rem;
  color: #d8dbef;
  font-size: 0.75rem;
}

.marca__simbolo,
.numero {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  font-weight: 800;
}

.marca__simbolo {
  border: 1px solid #9298c4;
  background: rgba(255, 255, 255, 0.08);
}

.barra__acciones {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.barra__enlace {
  color: white;
  font-size: 0.86rem;
  font-weight: 700;
  text-decoration: none;
}

.barra__enlace:hover,
.presentacion__enlace:hover,
.boton-texto:hover {
  text-decoration: underline;
}

.boton-salir {
  padding: 0.7rem 1rem;
  border: 1px solid #8f96c0;
  border-radius: 10px;
  background: transparent;
  color: white;
  font-weight: 700;
}

.boton-salir:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.contenido {
  padding-block: 2.5rem 4rem;
}

.presentacion {
  margin-bottom: 1.25rem;
  padding: 2rem;
  border-radius: 20px;
  color: white;
  background: linear-gradient(115deg, #252a62, #3b4788);
  box-shadow: 0 12px 32px rgba(33, 39, 82, 0.12);
}

.etiqueta,
.subtitulo {
  color: #fbd071;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.presentacion h1 {
  margin: 0.7rem 0;
  color: white;
  font-size: clamp(1.8rem, 3vw, 2.6rem);
}

.presentacion p {
  color: #e1e5f4;
  line-height: 1.6;
}

.presentacion__enlace {
  display: inline-block;
  margin-top: 0.4rem;
  color: white;
  font-weight: 700;
  text-decoration: none;
}

.resumen-gestion {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1.5rem;
}

.resumen-gestion div {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
}

.resumen-gestion strong {
  font-size: 1.35rem;
  line-height: 1.2;
}

.resumen-gestion span {
  color: #e1e5f4;
  font-size: 0.78rem;
}

.panel {
  margin-bottom: 1.25rem;
  padding: 1.5rem;
  border: 1px solid #e2e6ef;
  border-radius: 18px;
  background: white;
  box-shadow: 0 8px 24px rgba(33, 39, 82, 0.05);
}

.titulo-panel {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.titulo-panel--separado {
  justify-content: space-between;
}

.titulo-panel h2 {
  margin: 0 0 0.4rem;
  color: #252b62;
  font-size: 1.15rem;
}

.titulo-panel p {
  margin: 0;
  color: #58657a;
  line-height: 1.6;
}

.numero {
  background: #edf0f8;
  color: #303875;
  font-size: 0.85rem;
}

.selector-archivo {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  margin-top: 1.5rem;
  padding: 1.4rem;
  border: 2px dashed #c7cfe3;
  border-radius: 16px;
  background: #f7f8fd;
}

.selector-archivo__icono {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #e9ebf6;
  color: #303875;
}

.selector-archivo__icono svg {
  width: 25px;
  height: 25px;
}

.selector-archivo strong {
  color: #252b62;
}

.selector-archivo p,
.periodo-manual p {
  color: #58657a;
  font-size: 0.88rem;
  line-height: 1.6;
}

.input-archivo {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.input-archivo:focus-visible + label {
  outline: 3px solid #f7b032;
  outline-offset: 3px;
}

.input-archivo:disabled + label {
  opacity: 0.6;
  cursor: not-allowed;
}

.archivo-elegido {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #d9deeb;
  border-radius: 12px;
  background: white;
}

.archivo-elegido__superior {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.archivo-elegido__nombre {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.archivo-elegido__nombre small,
.archivo-elegido__nombre strong {
  display: block;
  overflow-wrap: anywhere;
}

.archivo-elegido__nombre small {
  margin-bottom: 0.2rem;
  color: #58657a;
}

.archivo-icono {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  background: #edf0f8;
  color: #303875;
  font-size: 0.7rem;
  font-weight: 800;
}

.periodo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
  color: #58657a;
  font-size: 0.85rem;
}

.periodo strong {
  color: #303875;
}

.periodo-manual {
  margin-top: 1rem;
}

.periodo-manual__campos {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.periodo-manual__campos label {
  min-width: 150px;
  display: grid;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
}

input[type='number'],
select {
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  border: 1px solid #cfd6e4;
  border-radius: 9px;
  background: white;
  color: #242c40;
}

.confirmacion {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  margin: 1.2rem 0;
  font-size: 0.88rem;
  line-height: 1.6;
}

.confirmacion input {
  width: 17px;
  height: 17px;
  margin-top: 0.2rem;
}

.boton {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.7rem 1rem;
  border: 1px solid transparent;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.boton--principal {
  background: #303875;
  color: white;
}

.boton--principal:hover:not(:disabled) {
  background: #21295f;
}

.boton--secundario {
  border-color: #cfd6e4;
  background: #f4f6fb;
  color: #303875;
}

.boton--secundario:hover:not(:disabled) {
  background: #e8ecf7;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.boton-texto {
  padding: 0.3rem 0;
  border: 0;
  background: transparent;
  color: #303875;
  font-weight: 700;
}

.nota {
  color: #58657a;
  font-size: 0.85rem;
  line-height: 1.6;
}

.mensaje {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  border-left: 3px solid #e2b047;
  border-radius: 0 9px 9px 0;
  background: #fff8e8;
  color: #514a3b;
  font-size: 0.88rem;
  line-height: 1.5;
}

.mensaje--error {
  border-left-color: #bb554e;
  background: #fff2f0;
  color: #813831;
}

.tabla-contenedor {
  width: 100%;
  margin-top: 1.1rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

caption {
  margin-bottom: 0.6rem;
  color: #58657a;
  font-size: 0.8rem;
  text-align: left;
}

th,
td {
  padding: 0.8rem 0.7rem;
  border-bottom: 1px solid #e7eaf1;
  vertical-align: top;
  line-height: 1.45;
}

th {
  color: #303875;
  font-weight: 700;
  white-space: nowrap;
}

td {
  color: #384257;
}

.tabla-secundario {
  display: block;
  margin-top: 0.2rem;
  color: #687489;
}

.estado,
.aviso-periodo {
  display: inline-block;
  padding: 0.3rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
}

.estado--correcto {
  background: #e8f5ee;
  color: #256543;
}

.estado--error {
  background: #fff2f0;
  color: #813831;
}

.estado--pendiente {
  background: #eff1f5;
  color: #596579;
}

.aviso-periodo {
  display: block;
  width: fit-content;
  margin-top: 0.35rem;
  background: #fff8e8;
  color: #73501a;
}

.resumen {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1.4rem;
  padding: 1.2rem;
  border-radius: 12px;
  background: #f5f6fa;
}

.resumen span,
.resumen strong {
  display: block;
}

.resumen span {
  margin-bottom: 0.3rem;
  color: #58657a;
  font-size: 0.78rem;
}

.resumen strong {
  color: #252b3c;
  font-size: 0.9rem;
}

.encabezado-resultados {
  margin-top: 1.7rem;
}

.subtitulo {
  color: #5665a8;
}

.encabezado-resultados h3,
.titulo-apartado,
.publicacion h3 {
  margin: 0.4rem 0 0;
  color: #252b62;
  font-size: 1rem;
}

.indicadores {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.indicador {
  min-width: 0;
  padding: 1.2rem;
  border: 1px solid #e2e6ef;
  border-radius: 14px;
  background: #f8f9fd;
}

.indicador > span {
  display: block;
  color: #58657a;
  font-size: 0.82rem;
  font-weight: 700;
}

.indicador > strong {
  display: block;
  margin-top: 0.7rem;
  color: #303875;
  font-size: clamp(1.2rem, 2vw, 1.6rem);
  overflow-wrap: anywhere;
}

.indicador p,
.indicador small {
  color: #58657a;
  font-size: 0.84rem;
  line-height: 1.6;
}

.indicador__grafica {
  margin-top: 1rem;
}

.indicador__grafica progress {
  width: 100%;
  height: 14px;
  accent-color: #303875;
}

.indicador__escala {
  display: flex;
  justify-content: space-between;
  color: #58657a;
  font-size: 0.75rem;
}

.filtro-resultados {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem;
  margin-top: 1.4rem;
}

.filtro-resultados label {
  color: #39435c;
  font-size: 0.85rem;
  font-weight: 700;
}

.filtro-resultados select {
  min-width: 190px;
}

.detalles {
  margin-top: 1rem;
  color: #58657a;
  font-size: 0.85rem;
  line-height: 1.6;
}

.detalles summary {
  color: #303875;
  font-weight: 700;
  cursor: pointer;
}

.titulo-apartado {
  margin-top: 1.7rem;
}

.publicacion {
  display: flex;
  align-items: end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e6ef;
}

.pie {
  padding: 1.4rem 0;
  border-top: 1px solid #e0e4ed;
  color: #687489;
  font-size: 0.82rem;
}

@media (max-width: 700px) {
  .barra__contenido,
  .contenido,
  .pie > div {
    width: calc(100% - 2rem);
  }

  .contenido {
    padding-top: 1.5rem;
  }

  .presentacion,
  .panel {
    padding: 1.2rem;
  }

  .resumen-gestion,
  .resumen,
  .indicadores {
    grid-template-columns: 1fr;
  }

  .titulo-panel--separado,
  .selector-archivo {
    flex-direction: column;
  }

  .barra__acciones {
    gap: 0.5rem;
  }

  .barra__enlace {
    font-size: 0.78rem;
  }

  .boton-salir {
    padding: 0.65rem 0.75rem;
    font-size: 0.8rem;
  }

  .marca small {
    display: none;
  }
}
</style>
