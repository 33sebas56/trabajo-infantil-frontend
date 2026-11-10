<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import PanelComparativo from '../components/PanelComparativo.vue'
import { solicitarApi } from '../services/api'
import { estadoSesion } from '../services/authService'
import {
  compararEstadisticas,
  formatearValor,
  listarPeriodosPublicados,
  type ComparacionEstadisticas,
  type Edad,
  type FiltrosEstadisticas,
  type Periodo,
  type PuntoEstadistica,
  type Sexo,
} from '../services/estadisticasService'

type Consulta = {
  trimestre: number
  desde: number
  hasta: number
  edad: Edad
  sexo: Sexo
  indicador: string
}

type Fila = {
  etiqueta: string
  valor: number | null
  estado: string
  mensaje: string | null
}

type GruposAnio = {
  anio: number
  edades: Fila[]
  sexos: Fila[]
}

type ResultadoPublico = {
  codigoIndicador: string
  valor: number | null
  numerador: number | null
  denominador: number | null
}

// El backend puede adjuntar una observación sobre la comparación.
type ComparacionConAdvertencia = ComparacionEstadisticas & {
  advertencia?: string | null
}

const ACTIVIDAD = 'RESPUESTAS_AFIRMATIVAS_TRABAJO'

const opciones = [
  {
    grupo: 'Actividad laboral',
    valores: [
      {
        codigo: ACTIVIDAD,
        nombre: 'Respuestas afirmativas sobre actividad laboral',
      },
      {
        codigo: 'POBLACION_CON_RESPUESTAS_TRABAJO',
        nombre: 'Población estimada con respuestas afirmativas',
      },
    ],
  },
  {
    grupo: 'Educación',
    valores: [
      {
        codigo: 'ASISTE_INSTITUCION',
        nombre: 'Asistencia a una institución educativa',
      },
      {
        codigo: 'SABE_LEER_ESCRIBIR',
        nombre: 'Saben leer y escribir',
      },
      {
        codigo: 'ASISTENCIA_CON_ACTIVIDAD',
        nombre: 'Asistencia educativa y actividad laboral',
      },
      {
        codigo: 'LECTURA_CON_ACTIVIDAD',
        nombre: 'Lectura y escritura y actividad laboral',
      },
    ],
  },
  {
    grupo: 'Otras condiciones',
    valores: [
      {
        codigo: 'COCINA_PLATOS_MESA_HOGAR',
        nombre: 'Tareas de cocina, platos o mesa en el hogar',
      },
      {
        codigo: 'SALARIO_MENSUAL_P409',
        nombre: 'Ingreso mensual por empleo',
      },
      {
        codigo: 'GANANCIA_MENSUAL_P413',
        nombre: 'Ganancia mensual independiente',
      },
    ],
  },
  {
    grupo: 'Motivo principal',
    valores: [
      {
        codigo: 'MOTIVO_TRABAJO_P405_1',
        nombre: 'Costear sus estudios',
      },
      {
        codigo: 'MOTIVO_TRABAJO_P405_2',
        nombre: 'Ayudar con los gastos del hogar',
      },
      {
        codigo: 'MOTIVO_TRABAJO_P405_3',
        nombre: 'Participar en la actividad familiar',
      },
      {
        codigo: 'MOTIVO_TRABAJO_P405_4',
        nombre: 'Considera que el trabajo le forma',
      },
      {
        codigo: 'MOTIVO_TRABAJO_P405_5',
        nombre: 'Considera que el trabajo le aleja de los vicios',
      },
      {
        codigo: 'MOTIVO_TRABAJO_P405_6',
        nombre: 'Tener su propio dinero',
      },
      {
        codigo: 'MOTIVO_TRABAJO_P405_7',
        nombre: 'Otra razón',
      },
    ],
  },
]

const periodos = ref<Periodo[]>([])

const trimestre = ref(4)
const desde = ref<number | null>(null)
const hasta = ref<number | null>(null)
const edad = ref<Edad>('TODAS')
const sexo = ref<Sexo>('TODOS')
const indicador = ref(ACTIVIDAD)

const cargandoPeriodos = ref(true)
const consultando = ref(false)

const errorPeriodos = ref('')
const errorFormulario = ref('')
const errorComparacion = ref('')

const aplicada = ref<Consulta | null>(null)
const comparacion = ref<ComparacionConAdvertencia | null>(null)

const detalles = ref<Record<number, ResultadoPublico | null>>({})

const gruposPorAnio = ref<GruposAnio[]>([])

const trimestres = computed(() => {
  return [...new Set(periodos.value.map((periodo) => periodo.trimestre))].sort()
})

const anios = computed(() => {
  return [
    ...new Set(
      periodos.value
        .filter((periodo) => periodo.trimestre === trimestre.value)
        .map((periodo) => periodo.anio),
    ),
  ].sort((a, b) => a - b)
})

function ajustarAnios(): void {
  const disponibles = anios.value

  if (!disponibles.length) {
    desde.value = null
    hasta.value = null
    return
  }

  const ultimo = disponibles[disponibles.length - 1]!

  // El servidor admite un rango máximo de 31 años.
  desde.value = disponibles.find((anio) => ultimo - anio <= 30) ?? ultimo

  hasta.value = ultimo
}

watch(trimestre, ajustarAnios, { flush: 'sync' })

const cambiosPendientes = computed(() => {
  const consulta = aplicada.value

  return (
    !!consulta &&
    (consulta.trimestre !== trimestre.value ||
      consulta.desde !== desde.value ||
      consulta.hasta !== hasta.value ||
      consulta.edad !== edad.value ||
      consulta.sexo !== sexo.value ||
      consulta.indicador !== indicador.value)
  )
})

function nombreTrimestre(valor: number): string {
  return (
    ['Primer trimestre', 'Segundo trimestre', 'Tercer trimestre', 'Cuarto trimestre'][valor - 1] ??
    `Trimestre ${valor}`
  )
}

function nombreEdad(valor: Edad): string {
  if (valor === '5_14') return '5 a 14 años'
  if (valor === '15_17') return '15 a 17 años'

  return 'Todas las edades'
}

function nombreSexo(valor: Sexo): string {
  if (valor === 'MASCULINO') return 'Masculino'
  if (valor === 'FEMENINO') return 'Femenino'
  if (valor === 'SIN_DATO') return 'Sin dato de sexo'

  return 'Todos los sexos'
}

function nombreIndicador(codigo: string): string {
  return (
    opciones.flatMap((grupo) => grupo.valores).find((item) => item.codigo === codigo)?.nombre ??
    'Indicador seleccionado'
  )
}

function etiquetasIndicador(codigo: string): {
  afirmativo: string
  negativo: string
  base: string
} {
  if (codigo === ACTIVIDAD) {
    return {
      afirmativo: 'Con respuesta afirmativa',
      negativo: 'Sin respuesta afirmativa',
      base: 'Sobre las respuestas válidas a las preguntas de actividad laboral.',
    }
  }
  if (codigo === 'ASISTE_INSTITUCION' || codigo === 'ASISTENCIA_CON_ACTIVIDAD') {
    return {
      afirmativo: 'Asisten',
      negativo: 'No asisten',
      base:
        codigo === 'ASISTENCIA_CON_ACTIVIDAD'
          ? 'Entre quienes reportaron actividad laboral y respondieron sobre asistencia.'
          : 'Entre quienes respondieron sobre asistencia educativa.',
    }
  }
  if (codigo === 'SABE_LEER_ESCRIBIR' || codigo === 'LECTURA_CON_ACTIVIDAD') {
    return {
      afirmativo: 'Saben leer y escribir',
      negativo: 'No saben leer y escribir',
      base:
        codigo === 'LECTURA_CON_ACTIVIDAD'
          ? 'Entre quienes reportaron actividad laboral y respondieron sobre lectura.'
          : 'Entre quienes respondieron sobre lectura y escritura.',
    }
  }
  if (codigo === 'COCINA_PLATOS_MESA_HOGAR') {
    return {
      afirmativo: 'Realizan estas tareas',
      negativo: 'No reportaron estas tareas',
      base: 'Entre quienes respondieron sobre tareas de cocina, platos o mesa.',
    }
  }
  if (codigo.startsWith('MOTIVO_TRABAJO_P405_')) {
    return {
      afirmativo: nombreIndicador(codigo),
      negativo: 'Indicaron otro motivo',
      base: 'Entre quienes informaron un motivo principal.',
    }
  }
  return {
    afirmativo: 'Con esta respuesta',
    negativo: 'Con otra respuesta válida',
    base: 'Sobre las respuestas válidas de este indicador.',
  }
}

function advertenciaClara(mensaje: string): string {
  if (mensaje.includes('cambió de redacción en 2024')) {
    return 'La pregunta sobre trabajo sin remuneración cambió de redacción en 2024.'
  }
  return mensaje
}

function numero(valor: number): string {
  if (valor > 0 && valor < 0.5) return '< 1'

  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(valor)
}

function textoValor(valor: number, unidad: string): string {
  if (unidad === 'PERSONAS') {
    return `${numero(valor)} personas estimadas`
  }

  return formatearValor(valor, unidad)
}

function esValido(punto: PuntoEstadistica): boolean {
  const valor = punto.valor

  if (
    punto.estado !== 'DISPONIBLE' ||
    typeof valor !== 'number' ||
    !Number.isFinite(valor) ||
    valor < 0
  ) {
    return false
  }

  return comparacion.value?.unidad !== 'PORCENTAJE' || valor <= 100
}

function textoEstado(estado: string): string {
  const nombres: Record<string, string> = {
    NO_DISPONIBLE: 'No disponible',
    NO_COMPARABLE: 'No comparable',
    PENDIENTE_REVISION: 'En revisión',
    INFORMACION_INSUFICIENTE: 'Información insuficiente',
    ERROR: 'No se pudo consultar',
  }

  return nombres[estado] ?? 'No disponible'
}

function obtenerPunto(anio: number): PuntoEstadistica {
  return (
    comparacion.value?.puntos.find((punto) => punto.anio === anio) ?? {
      anio,
      valor: null,
      estado: 'NO_DISPONIBLE',
      mensaje: 'No hay información disponible para este año.',
      muestra: null,
      versionRegla: null,
    }
  )
}

const extremos = computed(() => {
  if (!aplicada.value || !comparacion.value) return []

  const lista = [obtenerPunto(aplicada.value.desde)]

  if (aplicada.value.hasta !== aplicada.value.desde) {
    lista.push(obtenerPunto(aplicada.value.hasta))
  }

  return lista
})

function fondoAnillo(valor: number): string {
  return `conic-gradient(#394b97 0% ${valor}%, #f5bd45 ${valor}% 100%)`
}

function criterioYGrupo(filtros: FiltrosEstadisticas): { criterio: string; grupo: string } {
  if (filtros.edad === 'TODAS' && filtros.sexo === 'TODOS') {
    return {
      criterio: 'GENERAL',
      grupo: 'TOTAL',
    }
  }

  if (filtros.edad === 'TODAS') {
    return {
      criterio: 'SEXO',
      grupo: filtros.sexo,
    }
  }

  if (filtros.sexo === 'TODOS') {
    return {
      criterio: 'EDAD',
      grupo: filtros.edad,
    }
  }

  return {
    criterio: 'EDAD_SEXO',
    grupo: `${filtros.edad}_${filtros.sexo}`,
  }
}

async function obtenerDetalle(anio: number, consulta: Consulta): Promise<ResultadoPublico | null> {
  const periodo = periodos.value.find(
    (item) => item.anio === anio && item.trimestre === consulta.trimestre,
  )

  if (!periodo) return null

  const filtros: FiltrosEstadisticas = {
    anio,
    trimestre: consulta.trimestre,
    edad: consulta.edad,
    sexo: consulta.sexo,
  }

  const parametros = new URLSearchParams(criterioYGrupo(filtros))

  try {
    const resultados = await solicitarApi<ResultadoPublico[]>(
      `/api/publico/periodos/${periodo.id}/resultados?${parametros}`,
      { cache: 'no-store' },
    )

    return resultados.find((resultado) => resultado.codigoIndicador === consulta.indicador) ?? null
  } catch {
    return null
  }
}

function baseEstimada(punto: PuntoEstadistica): { parte: number; total: number } | null {
  if (comparacion.value?.unidad !== 'PORCENTAJE' || !esValido(punto)) {
    return null
  }

  const resultado = detalles.value[punto.anio]
  const parte = resultado?.numerador
  const total = resultado?.denominador

  if (
    typeof parte !== 'number' ||
    !Number.isFinite(parte) ||
    parte < 0 ||
    typeof total !== 'number' ||
    !Number.isFinite(total) ||
    total <= 0 ||
    parte > total ||
    Math.abs((parte / total) * 100 - (punto.valor ?? 0)) > 0.01
  ) {
    return null
  }

  return { parte, total }
}

function textoBaseEstimada(punto: PuntoEstadistica): string {
  const base = baseEstimada(punto)

  return base ? `${numero(base.parte)} de ${numero(base.total)} personas estimadas` : ''
}

type Grupo = {
  etiqueta: string
  edad?: Edad
  sexo?: Sexo
}

async function consultarGrupos(consulta: Consulta, anio: number, grupos: Grupo[]): Promise<Fila[]> {
  return Promise.all(
    grupos.map(async (grupo): Promise<Fila> => {
      const filtros: FiltrosEstadisticas = {
        anio,
        trimestre: consulta.trimestre,
        edad: grupo.edad ?? consulta.edad,
        sexo: grupo.sexo ?? consulta.sexo,
      }

      try {
        const datos = await compararEstadisticas(filtros, consulta.indicador, anio, anio)

        const punto = datos.puntos.find((item) => item.anio === anio)

        if (!punto) {
          return {
            etiqueta: grupo.etiqueta,
            valor: null,
            estado: 'NO_DISPONIBLE',
            mensaje: null,
          }
        }

        const valor = punto.valor

        const valido =
          punto.estado === 'DISPONIBLE' &&
          typeof valor === 'number' &&
          Number.isFinite(valor) &&
          valor >= 0 &&
          (datos.unidad !== 'PORCENTAJE' || valor <= 100)

        return {
          etiqueta: grupo.etiqueta,
          valor: valido ? valor : null,
          estado: valido
            ? 'DISPONIBLE'
            : punto.estado === 'DISPONIBLE'
              ? 'NO_DISPONIBLE'
              : punto.estado,
          mensaje: punto.mensaje,
        }
      } catch {
        return {
          etiqueta: grupo.etiqueta,
          valor: null,
          estado: 'ERROR',
          mensaje: 'No fue posible consultar este grupo.',
        }
      }
    }),
  )
}

function filaDisponible(fila: Fila): boolean {
  return (
    fila.estado === 'DISPONIBLE' &&
    typeof fila.valor === 'number' &&
    Number.isFinite(fila.valor) &&
    fila.valor >= 0
  )
}

function maximoGrupos(tipo: 'edades' | 'sexos'): number | null {
  const valores = gruposPorAnio.value
    .flatMap((grupo) => grupo[tipo])
    .filter(filaDisponible)
    .map((fila) => fila.valor ?? 0)
  return valores.length ? Math.max(...valores) : null
}

function anchoGrupo(fila: Fila, tipo: 'edades' | 'sexos'): string {
  const maximo = maximoGrupos(tipo)
  if (!filaDisponible(fila) || maximo === null || maximo === 0) return '0%'
  return `${((fila.valor ?? 0) / maximo) * 100}%`
}

const filasAnios = computed<Fila[]>(() => {
  return (
    comparacion.value?.puntos.map((punto) => ({
      etiqueta: String(punto.anio),

      valor: esValido(punto) ? punto.valor : null,

      estado: esValido(punto)
        ? 'DISPONIBLE'
        : punto.estado === 'DISPONIBLE'
          ? 'NO_DISPONIBLE'
          : punto.estado,

      mensaje: punto.mensaje,
    })) ?? []
  )
})

const resumenCambio = computed(() => {
  const consulta = aplicada.value
  const datos = comparacion.value

  if (!consulta || !datos) return ''

  if (consulta.desde === consulta.hasta) {
    return 'Selecciona dos años diferentes para conocer el cambio.'
  }

  const primero = obtenerPunto(consulta.desde)
  const ultimo = obtenerPunto(consulta.hasta)

  if (!esValido(primero) || !esValido(ultimo)) {
    return 'No hay datos comparables para los dos años seleccionados.'
  }

  const valorPrimero = primero.valor ?? 0
  const valorUltimo = ultimo.valor ?? 0
  const diferencia = valorUltimo - valorPrimero

  if (diferencia === 0) {
    return `El resultado de ${consulta.hasta} es igual al de ${consulta.desde}.`
  }

  if (datos.unidad === 'PORCENTAJE') {
    // La diferencia coincide con los porcentajes redondeados que ve el usuario.
    const redondear = (valor: number) =>
      Number(
        new Intl.NumberFormat('en-US', {
          useGrouping: false,
          maximumFractionDigits: 2,
        }).format(valor),
      )
    const diferenciaMostrada = redondear(valorUltimo) - redondear(valorPrimero)
    const diferenciaVisible = Math.round(diferenciaMostrada * 100) / 100
    const valorPequeno =
      (valorPrimero > 0 && valorPrimero < 0.01) || (valorUltimo > 0 && valorUltimo < 0.01)
    const diferenciaParaMostrar = valorPequeno ? diferencia : diferenciaVisible
    if (diferenciaParaMostrar === 0) {
      return 'Los porcentajes mostrados son iguales después de redondear.'
    }
    const cantidad =
      Math.abs(diferenciaParaMostrar) < 0.01
        ? 'menos de 0,01'
        : new Intl.NumberFormat('es-CO', {
            maximumFractionDigits: 2,
          }).format(Math.abs(diferenciaParaMostrar))

    const signo = diferenciaParaMostrar > 0 ? '+' : '−'
    return `Diferencia entre los porcentajes: ${signo}${cantidad} puntos porcentuales (${consulta.hasta} frente a ${consulta.desde}).`
  }

  const direccion = diferencia > 0 ? 'mayor' : 'menor'
  return (
    `En ${consulta.hasta}, el resultado fue ` +
    `${textoValor(Math.abs(diferencia), datos.unidad)} ` +
    `${direccion} que en ${consulta.desde}.`
  )
})

const notaIndicador = computed(() => {
  const codigo = aplicada.value?.indicador ?? ''

  if (codigo === ACTIVIDAD || codigo === 'POBLACION_CON_RESPUESTAS_TRABAJO') {
    return (
      'Las respuestas afirmativas corresponden a las preguntas de ' +
      'actividad utilizadas; no equivalen automáticamente a la ' +
      'tasa oficial de trabajo infantil.'
    )
  }

  if (codigo === 'COCINA_PLATOS_MESA_HOGAR') {
    return 'Las tareas en el hogar no definen por sí solas el trabajo infantil.'
  }

  if (codigo === 'SALARIO_MENSUAL_P409' || codigo === 'GANANCIA_MENSUAL_P413') {
    return 'Los valores corresponden a pesos corrientes, sin ajuste por inflación.'
  }

  return ''
})

async function cargarPeriodos(): Promise<void> {
  cargandoPeriodos.value = true
  errorPeriodos.value = ''

  try {
    periodos.value = [...(await listarPeriodosPublicados())].sort(
      (a, b) => b.anio - a.anio || b.trimestre - a.trimestre,
    )

    const reciente = periodos.value[0]

    if (reciente) {
      trimestre.value = reciente.trimestre
      ajustarAnios()
      await consultar()
    }
  } catch (error) {
    errorPeriodos.value =
      error instanceof Error ? error.message : 'No fue posible consultar los periodos.'
  } finally {
    cargandoPeriodos.value = false
  }
}

async function consultar(): Promise<void> {
  if (consultando.value) return

  if (
    desde.value === null ||
    hasta.value === null ||
    !anios.value.includes(desde.value) ||
    !anios.value.includes(hasta.value) ||
    desde.value > hasta.value ||
    hasta.value - desde.value > 30
  ) {
    errorFormulario.value = 'Elige años publicados en orden, con un intervalo máximo de 31 años.'

    return
  }

  const consulta: Consulta = {
    trimestre: trimestre.value,
    desde: desde.value,
    hasta: hasta.value,
    edad: edad.value,
    sexo: sexo.value,
    indicador: indicador.value,
  }

  const filtros: FiltrosEstadisticas = {
    anio: consulta.hasta,
    trimestre: consulta.trimestre,
    edad: consulta.edad,
    sexo: consulta.sexo,
  }

  const gruposEdad: Grupo[] =
    consulta.edad === 'TODAS'
      ? [
          { etiqueta: '5 a 14 años', edad: '5_14' },
          { etiqueta: '15 a 17 años', edad: '15_17' },
        ]
      : []

  const gruposSexo: Grupo[] =
    consulta.sexo === 'TODOS'
      ? [
          { etiqueta: 'Masculino', sexo: 'MASCULINO' },
          { etiqueta: 'Femenino', sexo: 'FEMENINO' },
          { etiqueta: 'Sin dato de sexo', sexo: 'SIN_DATO' },
        ]
      : []

  errorFormulario.value = ''
  errorComparacion.value = ''

  aplicada.value = consulta
  comparacion.value = null
  detalles.value = {}

  gruposPorAnio.value = []

  consultando.value = true

  try {
    const aniosExtremos =
      consulta.desde === consulta.hasta ? [consulta.desde] : [consulta.desde, consulta.hasta]

    const [principal, grupos, detalleInicial, detalleFinal] = await Promise.all([
      compararEstadisticas(filtros, consulta.indicador, consulta.desde, consulta.hasta)
        .then((datos) => ({ datos, error: '' }))
        .catch((error: unknown) => ({
          datos: null,
          error:
            error instanceof Error ? error.message : 'No fue posible consultar la comparación.',
        })),

      Promise.all(
        aniosExtremos.map(async (anio): Promise<GruposAnio> => {
          const [edades, sexos] = await Promise.all([
            consultarGrupos(consulta, anio, gruposEdad),
            consultarGrupos(consulta, anio, gruposSexo),
          ])
          return {
            anio,
            edades,
            sexos: sexos.filter(
              (fila) =>
                fila.etiqueta !== 'Sin dato de sexo' ||
                fila.estado === 'DISPONIBLE' ||
                fila.estado === 'ERROR',
            ),
          }
        }),
      ),

      obtenerDetalle(consulta.desde, consulta),

      consulta.hasta === consulta.desde
        ? Promise.resolve(null)
        : obtenerDetalle(consulta.hasta, consulta),
    ])

    comparacion.value = principal.datos
    errorComparacion.value = principal.error

    gruposPorAnio.value = grupos

    detalles.value = {
      [consulta.desde]: detalleInicial,
    }

    if (consulta.hasta !== consulta.desde) {
      detalles.value[consulta.hasta] = detalleFinal
    }
  } finally {
    consultando.value = false
  }
}

onMounted(() => {
  void cargarPeriodos()
})
</script>

<template>
  <div class="cmp-pagina">
    <header class="cmp-cabecera">
      <div class="contenedor cmp-cabecera-interior">
        <RouterLink to="/" class="cmp-marca" aria-label="Ir al inicio">
          <span class="cmp-marca-simbolo" aria-hidden="true"> P </span>

          <span>
            <strong>Trabajo <span class="marca-amarilla">Infantil</span></strong>
            <small>Información estadística · Pasto</small>
          </span>
        </RouterLink>

        <RouterLink
          v-if="estadoSesion === 'inactiva'"
          :to="{ name: 'ingresar' }"
          class="cmp-acceso"
        >
          Acceso administrativo
        </RouterLink>

        <RouterLink v-else :to="{ name: 'administracion' }" class="cmp-acceso">
          {{ estadoSesion === 'activa' ? 'Mi panel' : 'Administración' }}
        </RouterLink>
      </div>
    </header>

    <main class="contenedor cmp-contenido">
      <RouterLink to="/" class="cmp-volver"> ← Volver al inicio </RouterLink>

      <div class="cmp-presentacion">
        <span class="cmp-etiqueta"> INFORMACIÓN PARA LA CIUDADANÍA </span>

        <h1>Comparemos los datos</h1>

        <p>Selecciona los años y consulta los resultados del grupo que elijas.</p>
      </div>

      <section class="cmp-filtros" aria-labelledby="cmp-titulo-filtros">
        <div class="cmp-titulo-filtros">
          <div>
            <span class="cmp-etiqueta"> PERSONALIZA TU CONSULTA </span>

            <h2 id="cmp-titulo-filtros">¿Qué información quieres ver?</h2>
          </div>

          <span class="cmp-distintivo"> Pasto · DANE </span>
        </div>

        <p v-if="cargandoPeriodos" class="cmp-aviso" role="status">
          Consultando los periodos publicados...
        </p>

        <p v-else-if="errorPeriodos" class="cmp-aviso cmp-error" role="alert">
          {{ errorPeriodos }}

          <button type="button" class="cmp-reintentar" @click="cargarPeriodos">Reintentar</button>
        </p>

        <p v-else-if="!periodos.length" class="cmp-aviso">Aún no hay periodos publicados.</p>

        <form v-else class="cmp-formulario" @submit.prevent="consultar">
          <label>
            Trimestre

            <select v-model.number="trimestre" :disabled="consultando">
              <option v-for="t in trimestres" :key="t" :value="t">
                {{ nombreTrimestre(t) }}
              </option>
            </select>
          </label>

          <label>
            Desde el año

            <select v-model.number="desde" :disabled="consultando">
              <option v-for="anio in anios" :key="anio" :value="anio">
                {{ anio }}
              </option>
            </select>
          </label>

          <label>
            Hasta el año

            <select v-model.number="hasta" :disabled="consultando">
              <option v-for="anio in anios" :key="anio" :value="anio">
                {{ anio }}
              </option>
            </select>
          </label>

          <label>
            Edad

            <select v-model="edad" :disabled="consultando">
              <option value="TODAS">Todas las edades</option>
              <option value="5_14">5 a 14 años</option>
              <option value="15_17">15 a 17 años</option>
            </select>
          </label>

          <label>
            Sexo

            <select v-model="sexo" :disabled="consultando">
              <option value="TODOS">Todos los sexos</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
              <option value="SIN_DATO">Sin dato de sexo</option>
            </select>
          </label>

          <label class="cmp-indicador">
            Indicador

            <select v-model="indicador" :disabled="consultando">
              <optgroup v-for="grupo in opciones" :key="grupo.grupo" :label="grupo.grupo">
                <option v-for="opcion in grupo.valores" :key="opcion.codigo" :value="opcion.codigo">
                  {{ opcion.nombre }}
                </option>
              </optgroup>
            </select>
          </label>

          <button class="cmp-boton" type="submit" :disabled="consultando">
            {{ consultando ? 'Consultando...' : 'Ver resultados' }}
          </button>
        </form>

        <p v-if="errorFormulario" class="cmp-aviso cmp-error" role="alert">
          {{ errorFormulario }}
        </p>

        <p v-else-if="cambiosPendientes" class="cmp-aviso" role="status">
          Cambiaste los filtros. Pulsa «Ver resultados» para actualizar las gráficas.
        </p>
      </section>

      <p v-if="consultando && !cargandoPeriodos" class="cmp-aviso" role="status">
        Preparando los resultados...
      </p>

      <template v-else-if="aplicada && !cambiosPendientes && !cargandoPeriodos">
        <div class="cmp-seccion-titulo">
          <div>
            <span class="cmp-etiqueta"> COMPARACIÓN EN EL TIEMPO </span>

            <h2>Resultados de los años seleccionados</h2>
          </div>
        </div>

        <div class="cmp-contexto" aria-label="Filtros aplicados">
          <span>{{ nombreTrimestre(aplicada.trimestre) }}</span>

          <span>
            {{ aplicada.desde
            }}{{ aplicada.desde === aplicada.hasta ? '' : ` a ${aplicada.hasta}` }}
          </span>

          <span>{{ nombreEdad(aplicada.edad) }}</span>
          <span>{{ nombreSexo(aplicada.sexo) }}</span>
        </div>

        <p class="cmp-indicador-actual">
          <strong>Indicador:</strong>
          {{ nombreIndicador(aplicada.indicador) }}
        </p>

        <p v-if="errorComparacion" class="cmp-aviso cmp-error" role="alert">
          {{ errorComparacion }}
        </p>

        <template v-else-if="comparacion">
          <p v-if="comparacion.advertencia" class="cmp-aviso" role="note">
            {{ advertenciaClara(comparacion.advertencia) }}
          </p>

          <div class="cmp-anios" :class="{ 'cmp-anio-unico': extremos.length === 1 }">
            <article v-for="punto in extremos" :key="punto.anio" class="cmp-tarjeta">
              <div class="cmp-tarjeta-titulo">
                <span>RESULTADO DEL AÑO</span>
                <h3>{{ punto.anio }}</h3>
              </div>

              <template v-if="esValido(punto) && punto.valor !== null">
                <template v-if="comparacion.unidad === 'PORCENTAJE'">
                  <div
                    class="cmp-anillo"
                    :style="{ background: fondoAnillo(punto.valor) }"
                    role="img"
                    :aria-label="`${punto.anio}: ${etiquetasIndicador(aplicada.indicador).afirmativo}, ${textoValor(punto.valor, 'PORCENTAJE')}; ${etiquetasIndicador(aplicada.indicador).negativo}, ${textoValor(100 - punto.valor, 'PORCENTAJE')}.`"
                  >
                    <div class="cmp-anillo-centro">
                      <span>Resultado</span>

                      <strong>
                        {{ textoValor(punto.valor, comparacion.unidad) }}
                      </strong>

                      <small>porcentaje estimado</small>
                    </div>
                  </div>

                  <div class="cmp-leyenda">
                    <div>
                      <span>
                        <i class="cmp-punto cmp-azul"></i>
                        {{ etiquetasIndicador(aplicada.indicador).afirmativo }}
                      </span>

                      <strong>
                        {{ textoValor(punto.valor, 'PORCENTAJE') }}
                      </strong>
                    </div>

                    <div>
                      <span>
                        <i class="cmp-punto cmp-amarillo"></i>
                        {{ etiquetasIndicador(aplicada.indicador).negativo }}
                      </span>

                      <strong>
                        {{ textoValor(100 - punto.valor, 'PORCENTAJE') }}
                      </strong>
                    </div>
                  </div>

                  <p class="cmp-base">{{ etiquetasIndicador(aplicada.indicador).base }}</p>

                  <details v-if="textoBaseEstimada(punto)" class="cmp-detalle-estimacion">
                    <summary>Ver detalle de la estimación</summary>
                    <p>
                      Aproximadamente <strong>{{ textoBaseEstimada(punto) }}</strong> corresponden
                      al resultado. Estas cifras son estimaciones, no el número de registros.
                    </p>
                  </details>
                </template>

                <div v-else class="cmp-valor-directo">
                  <span>Resultado</span>

                  <strong>
                    {{ textoValor(punto.valor, comparacion.unidad) }}
                  </strong>
                </div>

                <p class="cmp-muestra">
                  Registros con respuesta válida:

                  <template
                    v-if="
                      punto.muestra !== null &&
                      Number.isInteger(punto.muestra) &&
                      punto.muestra >= 0
                    "
                  >
                    {{ numero(punto.muestra) }} registros
                  </template>

                  <template v-else> no disponible </template>
                </p>

                <p v-if="punto.mensaje" class="cmp-base">{{ punto.mensaje }}</p>
              </template>

              <div v-else class="cmp-sin-dato">
                <strong>{{ textoEstado(punto.estado) }}</strong>

                <p>
                  {{ punto.mensaje || 'No hay un resultado disponible para esta selección.' }}
                </p>
              </div>
            </article>
          </div>

          <div class="cmp-resumen">
            <span class="cmp-resumen-icono" aria-hidden="true"> ↗ </span>

            <p>
              <strong>Diferencia entre años</strong><br />
              {{ resumenCambio }}
            </p>
          </div>

          <p v-if="comparacion.unidad === 'PORCENTAJE'" class="cmp-nota">
            Cada anillo corresponde a su propio año. Los porcentajes son estimaciones calculadas con
            factores de expansión; los registros son la muestra analizada.
          </p>

          <p v-if="notaIndicador" class="cmp-nota">
            {{ notaIndicador }}
          </p>

          <div class="cmp-seccion-titulo">
            <div>
              <span class="cmp-etiqueta"> RESULTADOS POR GRUPO </span>

              <h2>Resultados por edad y sexo en cada año</h2>
            </div>
          </div>

          <p class="cmp-introduccion">
            Se muestran los grupos incluidos en tus filtros. Las barras de un mismo grupo utilizan
            la misma escala{{ aplicada.desde === aplicada.hasta ? '.' : ' en ambos años.' }}
          </p>

          <div
            v-if="gruposPorAnio.some((grupo) => grupo.edades.length || grupo.sexos.length)"
            class="cmp-grupos-anios"
          >
            <section v-for="grupo in gruposPorAnio" :key="grupo.anio" class="cmp-grupo-anio">
              <h3>Resultados de {{ grupo.anio }}</h3>
              <div class="cmp-grupos">
                <section v-if="grupo.edades.length" class="cmp-panel-grupo">
                  <h4>Por edad</h4>
                  <p>{{ nombreSexo(aplicada.sexo) }}</p>
                  <p v-if="maximoGrupos('edades') !== null" class="cmp-escala">
                    Escala común: 0 a
                    {{ textoValor(maximoGrupos('edades') ?? 0, comparacion.unidad) }}
                  </p>
                  <ul class="cmp-barras">
                    <li v-for="fila in grupo.edades" :key="fila.etiqueta">
                      <div>
                        <span>{{ fila.etiqueta }}</span
                        ><strong>{{
                          filaDisponible(fila)
                            ? textoValor(fila.valor ?? 0, comparacion.unidad)
                            : textoEstado(fila.estado)
                        }}</strong>
                      </div>
                      <div v-if="filaDisponible(fila)" class="cmp-pista" aria-hidden="true">
                        <span :style="{ width: anchoGrupo(fila, 'edades') }"></span>
                      </div>
                      <p v-if="fila.mensaje">{{ fila.mensaje }}</p>
                    </li>
                  </ul>
                </section>

                <section v-if="grupo.sexos.length" class="cmp-panel-grupo">
                  <h4>Por sexo</h4>
                  <p>{{ nombreEdad(aplicada.edad) }}</p>
                  <p v-if="maximoGrupos('sexos') !== null" class="cmp-escala">
                    Escala común: 0 a
                    {{ textoValor(maximoGrupos('sexos') ?? 0, comparacion.unidad) }}
                  </p>
                  <ul class="cmp-barras">
                    <li v-for="fila in grupo.sexos" :key="fila.etiqueta">
                      <div>
                        <span>{{ fila.etiqueta }}</span
                        ><strong>{{
                          filaDisponible(fila)
                            ? textoValor(fila.valor ?? 0, comparacion.unidad)
                            : textoEstado(fila.estado)
                        }}</strong>
                      </div>
                      <div v-if="filaDisponible(fila)" class="cmp-pista" aria-hidden="true">
                        <span :style="{ width: anchoGrupo(fila, 'sexos') }"></span>
                      </div>
                      <p v-if="fila.mensaje">{{ fila.mensaje }}</p>
                    </li>
                  </ul>
                </section>
              </div>
            </section>
          </div>

          <p v-else class="cmp-aviso">
            Para comparar grupos, selecciona «Todas las edades» o «Todos los sexos».
          </p>

          <div class="cmp-seccion-titulo">
            <div>
              <span class="cmp-etiqueta"> DETALLE DEL PERIODO </span>

              <h2>Resultados año por año</h2>
            </div>
          </div>

          <PanelComparativo
            :titulo="nombreIndicador(aplicada.indicador)"
            :descripcion="`Mismo trimestre, edad y sexo${
              comparacion.unidad === 'PERSONAS' ? ' · Personas estimadas' : ''
            }`"
            :unidad="comparacion.unidad"
            :filas="filasAnios"
          />

          <section class="cmp-tabla-panel" aria-labelledby="cmp-tabla-titulo">
            <h3 id="cmp-tabla-titulo">Detalle de resultados</h3>

            <div class="cmp-tabla-desplazamiento">
              <table>
                <caption>
                  {{
                    nombreTrimestre(aplicada.trimestre)
                  }}
                  ·
                  {{
                    nombreEdad(aplicada.edad)
                  }}
                  ·
                  {{
                    nombreSexo(aplicada.sexo)
                  }}
                </caption>

                <thead>
                  <tr>
                    <th scope="col">Año</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Detalle</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="punto in comparacion.puntos" :key="punto.anio">
                    <th scope="row">
                      {{ punto.anio }}
                    </th>

                    <td>
                      {{
                        esValido(punto) && punto.valor !== null
                          ? textoValor(punto.valor, comparacion.unidad)
                          : '—'
                      }}
                    </td>

                    <td>
                      {{ esValido(punto) ? 'Disponible' : textoEstado(punto.estado) }}
                    </td>

                    <td>
                      {{
                        punto.mensaje ||
                        (esValido(punto) ? '—' : 'Sin resultado para esta selección.')
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>
      </template>
    </main>

    <footer class="cmp-pie">
      <div class="contenedor">Información estadística de Pasto · Fuente: DANE</div>
    </footer>
  </div>
</template>

<style scoped>
.cmp-pagina {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
  color: #29334a;
}

.cmp-cabecera {
  background: #292e69;
  color: #fff;
}

.cmp-cabecera-interior {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cmp-marca {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: #fff;
  text-decoration: none;
}

.cmp-marca-simbolo {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid #9298c4;
  border-radius: 12px;
  font-weight: 800;
}

.cmp-marca strong,
.cmp-marca small {
  display: block;
}

.cmp-marca small {
  margin-top: 0.18rem;
  color: #e2e5f5;
  font-size: 0.75rem;
}

.cmp-acceso {
  padding: 0.65rem 0.85rem;
  border: 1px solid #9fa6cd;
  border-radius: 10px;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.cmp-acceso:hover {
  background: rgba(255, 255, 255, 0.1);
}

.cmp-contenido {
  flex: 1;
  padding-block: 2rem 4rem;
}

.cmp-volver,
.cmp-reintentar {
  color: #303875;
  font-size: 0.88rem;
  font-weight: 700;
}

.cmp-volver {
  text-decoration: none;
}

.cmp-volver:hover,
.cmp-reintentar:hover {
  text-decoration: underline;
}

.cmp-reintentar {
  border: 0;
  padding: 0;
  background: none;
}

.cmp-presentacion {
  margin: 2rem 0 1.5rem;
}

.cmp-etiqueta {
  color: #5263a2;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.cmp-presentacion h1 {
  margin: 0.55rem 0;
  color: #252b62;
  font-size: clamp(1.9rem, 4vw, 2.9rem);
  line-height: 1.15;
}

.cmp-presentacion p,
.cmp-introduccion {
  color: #59677c;
  line-height: 1.6;
}

.cmp-filtros,
.cmp-tarjeta,
.cmp-tabla-panel {
  border: 1px solid #e0e6f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(33, 39, 82, 0.05);
}

.cmp-filtros {
  padding: 1.5rem;
}

.cmp-titulo-filtros {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cmp-titulo-filtros h2,
.cmp-seccion-titulo h2 {
  margin: 0.4rem 0 0;
  color: #252b62;
  font-size: 1.3rem;
}

.cmp-distintivo {
  padding: 0.45rem 0.75rem;
  border-radius: 999px;
  background: #f2f4fb;
  color: #42518b;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.cmp-formulario {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: end;
  gap: 1rem;
  margin-top: 1.3rem;
}

.cmp-formulario label {
  display: grid;
  gap: 0.45rem;
  color: #39435c;
  font-size: 0.83rem;
  font-weight: 700;
}

.cmp-formulario select {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 0.65rem 0.7rem;
  border: 1px solid #cfd8e8;
  border-radius: 10px;
  background: #fff;
  color: #26324a;
}

.cmp-indicador {
  grid-column: span 4;
}

.cmp-boton {
  min-height: 46px;
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 10px;
  background: #303875;
  color: #fff;
  font-weight: 800;
}

.cmp-boton:hover {
  background: #22295d;
}

.cmp-boton:disabled {
  opacity: 0.65;
  cursor: wait;
}

.cmp-seccion-titulo {
  margin: 2.6rem 0 0.9rem;
}

.cmp-contexto {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cmp-contexto span {
  padding: 0.4rem 0.7rem;
  border-radius: 999px;
  background: #e9edf8;
  color: #364478;
  font-size: 0.79rem;
  font-weight: 700;
}

.cmp-indicador-actual {
  margin: 1.1rem 0;
  color: #48566e;
  font-size: 0.92rem;
}

.cmp-anios,
.cmp-grupos {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.1rem;
}

.cmp-anio-unico {
  grid-template-columns: minmax(0, 560px);
}

.cmp-tarjeta {
  min-width: 0;
  padding: 1.4rem;
}

.cmp-tarjeta-titulo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid #edf0f6;
}

.cmp-tarjeta-titulo span {
  color: #627093;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.cmp-tarjeta-titulo h3 {
  margin: 0;
  color: #29346f;
  font-size: 1.4rem;
}

.cmp-anillo {
  width: min(190px, 65%);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  margin: 1.25rem auto;
  border-radius: 50%;
}

.cmp-anillo-centro {
  width: 72%;
  height: 72%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.3rem;
  border-radius: 50%;
  background: #fff;
  text-align: center;
}

.cmp-anillo-centro span,
.cmp-anillo-centro small {
  color: #66748b;
  font-size: 0.72rem;
  line-height: 1.2;
}

.cmp-anillo-centro strong {
  color: #29346f;
  font-size: clamp(1.25rem, 2.5vw, 1.7rem);
  line-height: 1.1;
}

.cmp-leyenda {
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem;
  border-radius: 12px;
  background: #f7f8fc;
}

.cmp-leyenda div {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  color: #485671;
  font-size: 0.82rem;
}

.cmp-leyenda strong {
  color: #28366d;
  white-space: nowrap;
}

.cmp-punto {
  display: inline-block;
  width: 9px;
  height: 9px;
  margin-right: 0.5rem;
  border-radius: 50%;
}

.cmp-azul {
  background: #394b97;
}

.cmp-amarillo {
  background: #f5bd45;
}

.cmp-base,
.cmp-muestra {
  color: #58677b;
  font-size: 0.82rem;
  line-height: 1.55;
}

.cmp-base {
  margin: 1rem 0 0;
}

.cmp-base strong {
  color: #303c6c;
}

.cmp-detalle-estimacion {
  margin-top: 0.8rem;
  color: #58677b;
  font-size: 0.8rem;
  line-height: 1.5;
}
.cmp-detalle-estimacion summary {
  color: #0754ac;
  font-weight: 700;
  cursor: pointer;
}
.cmp-detalle-estimacion p {
  margin: 0.5rem 0 0;
}

.cmp-grupos-anios {
  display: grid;
  gap: 1.4rem;
}
.cmp-grupo-anio > h3 {
  margin: 0 0 0.7rem;
  color: #073b85;
  font-size: 1.05rem;
}
.cmp-panel-grupo {
  min-width: 0;
  padding: 1.3rem;
  border: 1px solid #d6e4f5;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(17, 57, 112, 0.05);
}
.cmp-panel-grupo h4 {
  margin: 0;
  color: #073b85;
  font-size: 1rem;
}
.cmp-panel-grupo p {
  margin: 0.35rem 0 0;
  color: #596b81;
  font-size: 0.82rem;
  line-height: 1.5;
}
.cmp-panel-grupo .cmp-escala {
  margin-top: 1rem;
  font-size: 0.75rem;
}
.cmp-barras {
  display: grid;
  gap: 1.15rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}
.cmp-barras li > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #29446e;
  font-size: 0.88rem;
}
.cmp-barras strong {
  color: #073b85;
  text-align: right;
}
.cmp-pista {
  height: 9px;
  margin-top: 0.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: #e9eef8;
}
.cmp-pista span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0754bf, #2389fa);
}
.cmp-barras li p {
  font-size: 0.78rem;
}

.cmp-muestra {
  margin: 0.8rem 0 0;
}

.cmp-valor-directo {
  min-height: 180px;
  display: grid;
  place-content: center;
  gap: 0.5rem;
  text-align: center;
  color: #67758d;
}

.cmp-valor-directo strong {
  color: #29346f;
  font-size: 1.7rem;
}

.cmp-sin-dato {
  min-height: 230px;
  display: grid;
  align-content: center;
  text-align: center;
  color: #5d6b80;
  line-height: 1.5;
}

.cmp-sin-dato strong {
  color: #354278;
}

.cmp-sin-dato p {
  margin: 0.5rem 0 0;
}

.cmp-resumen {
  display: flex;
  align-items: start;
  gap: 0.8rem;
  margin-top: 1rem;
  padding: 1rem 1.2rem;
  border-left: 4px solid #f1b83e;
  border-radius: 10px;
  background: #fff8e9;
  color: #404761;
  line-height: 1.5;
}

.cmp-resumen p {
  margin: 0;
}

.cmp-resumen strong {
  color: #29346f;
}

.cmp-resumen-icono {
  color: #9b710d;
  font-size: 1.2rem;
  font-weight: 800;
}

.cmp-nota {
  margin: 0.9rem 0;
  color: #5e6c80;
  font-size: 0.82rem;
  line-height: 1.55;
}

.cmp-aviso {
  margin: 1rem 0;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #edf1f9;
  color: #46536d;
  font-size: 0.88rem;
  line-height: 1.5;
}

.cmp-error {
  border-left: 3px solid #bb554e;
  background: #fff2f0;
  color: #813831;
}

.cmp-tabla-panel {
  margin-top: 1.1rem;
  padding: 1.4rem;
}

.cmp-tabla-panel h3 {
  margin: 0;
  color: #252b62;
}

.cmp-tabla-desplazamiento {
  width: 100%;
  margin-top: 1rem;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  text-align: left;
}

caption {
  margin-bottom: 0.7rem;
  color: #596579;
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
}

.cmp-pie {
  padding: 1.4rem 0;
  border-top: 1px solid #e0e4ed;
  color: #687489;
  font-size: 0.82rem;
}

@media (max-width: 950px) {
  .cmp-formulario {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cmp-indicador {
    grid-column: span 2;
  }
}

@media (max-width: 650px) {
  .cmp-anios,
  .cmp-anio-unico,
  .cmp-grupos,
  .cmp-formulario {
    grid-template-columns: 1fr;
  }

  .cmp-indicador {
    grid-column: auto;
  }

  .cmp-filtros,
  .cmp-tarjeta,
  .cmp-tabla-panel {
    padding: 1.1rem;
  }

  .cmp-titulo-filtros {
    align-items: start;
    flex-direction: column;
  }

  .cmp-marca small {
    display: none;
  }

  .cmp-acceso {
    font-size: 0.75rem;
  }
}
</style>
