<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import MapaPasto from '../components/MapaPasto.vue'
import PanelComparativo from '../components/PanelComparativo.vue'

import { estadoSesion as sesion } from '../services/authService'

import {
  compararEstadisticas,
  consultarEstadisticas,
  formatearValor,
  listarPeriodosPublicados,
  type ComparacionEstadisticas,
  type Edad,
  type FiltrosEstadisticas,
  type Indicador,
  type Periodo,
  type ResumenEstadisticas,
  type Sexo,
} from '../services/estadisticasService'

const ACTIVIDAD = 'RESPUESTAS_AFIRMATIVAS_TRABAJO'

type Fila = {
  etiqueta: string
  valor: number | null
  estado: string
  mensaje: string | null
}

/* -----------------------------------------
   Sesión y filtros
----------------------------------------- */

const periodos = ref<Periodo[]>([])
const periodoId = ref<number | null>(null)

const edad = ref<Edad>('TODAS')
const sexo = ref<Sexo>('TODOS')

const filtrosAplicados = ref<FiltrosEstadisticas | null>(null)

/* -----------------------------------------
   Resultados
----------------------------------------- */

const resumen = ref<ResumenEstadisticas | null>(null)

const filasEdad = ref<Fila[]>([])
const filasSexo = ref<Fila[]>([])
const filasAnio = ref<Fila[]>([])
const avisoComparacionAnual = ref('')

const cargandoPeriodos = ref(true)
const consultando = ref(false)

const errorPeriodos = ref('')
const errorResumen = ref('')

let numeroConsulta = 0

/* -----------------------------------------
   Tarjetas de información
----------------------------------------- */

const tarjetasPrincipales = [
  {
    codigo: ACTIVIDAD,
    titulo: 'Respuestas afirmativas',
    detalle: 'En las preguntas sobre actividad laboral',
  },
  {
    codigo: 'ASISTE_INSTITUCION',
    titulo: 'Asistencia educativa',
    detalle: 'Entre quienes respondieron',
  },
  {
    codigo: 'SABE_LEER_ESCRIBIR',
    titulo: 'Lectura y escritura',
    detalle: 'Saben leer y escribir',
  },
]

const distribuciones = [
  {
    codigo: ACTIVIDAD,
    titulo: 'Actividad laboral',
    descripcion: 'Respuestas a las preguntas sobre actividad laboral.',
    afirmativo: 'Con respuesta afirmativa',
    negativo: 'Sin respuesta afirmativa',
  },
  {
    codigo: 'ASISTE_INSTITUCION',
    titulo: 'Asistencia educativa',
    descripcion: 'Asistencia a una institución educativa.',
    afirmativo: 'Asisten',
    negativo: 'No asisten',
  },
]

const tarjetasAdicionales = [
  {
    codigo: 'ASISTENCIA_CON_ACTIVIDAD',
    titulo: 'Asistencia y actividad laboral',
    detalle: 'Entre quienes reportaron actividad laboral',
  },
  {
    codigo: 'SALARIO_MENSUAL_P409',
    titulo: 'Ingreso por empleo',
    detalle: 'Promedio mensual reportado',
  },
  {
    codigo: 'GANANCIA_MENSUAL_P413',
    titulo: 'Ganancia independiente',
    detalle: 'Promedio mensual reportado',
  },
]

/* -----------------------------------------
   Textos de filtros aplicados
----------------------------------------- */

const etiquetaPeriodo = computed(() => {
  const filtros = filtrosAplicados.value

  if (!filtros) {
    return ''
  }

  return `${filtros.anio} · ${nombreTrimestre(filtros.trimestre)}`
})

const etiquetaGrupo = computed(() => {
  const filtros = filtrosAplicados.value

  if (!filtros) {
    return ''
  }

  const edades = {
    TODAS: 'Todas las edades',
    '5_14': '5 a 14 años',
    '15_17': '15 a 17 años',
  }

  const sexos = {
    TODOS: 'Todos los sexos',
    MASCULINO: 'Masculino',
    FEMENINO: 'Femenino',
    SIN_DATO: 'Sin dato de sexo',
  }

  return `${edades[filtros.edad]} · ${sexos[filtros.sexo]}`
})

const filtrosPendientes = computed(() => {
  const aplicados = filtrosAplicados.value
  const seleccionado = periodos.value.find((item) => item.id === periodoId.value)
  if (!aplicados) return false
  return (
    !seleccionado ||
    seleccionado.anio !== aplicados.anio ||
    seleccionado.trimestre !== aplicados.trimestre ||
    edad.value !== aplicados.edad ||
    sexo.value !== aplicados.sexo
  )
})

function nombreTrimestre(numero: number): string {
  const nombres = ['Primer trimestre', 'Segundo trimestre', 'Tercer trimestre', 'Cuarto trimestre']

  return nombres[numero - 1] ?? `Trimestre ${numero}`
}

function advertenciaClara(mensaje: string): string {
  if (mensaje.includes('cambió de redacción en 2024')) {
    return 'La pregunta sobre trabajo sin remuneración cambió de redacción en 2024.'
  }
  return mensaje
}

/* -----------------------------------------
   Lectura de indicadores
----------------------------------------- */

function dato(codigo: string): Indicador | undefined {
  return resumen.value?.indicadores.find((indicador) => indicador.codigo === codigo)
}

function tieneValor(indicador: Indicador | undefined): boolean {
  return (
    indicador?.estado === 'DISPONIBLE' &&
    typeof indicador.valor === 'number' &&
    Number.isFinite(indicador.valor) &&
    indicador.valor >= 0 &&
    (indicador.unidad !== 'PORCENTAJE' || indicador.valor <= 100)
  )
}

function numeroRegistros(indicador: Indicador | undefined): string {
  const muestra = indicador?.muestra
  if (
    !tieneValor(indicador) ||
    typeof muestra !== 'number' ||
    !Number.isInteger(muestra) ||
    muestra < 0
  ) {
    return 'No disponible'
  }
  return new Intl.NumberFormat('es-CO').format(muestra)
}

function porcentaje(indicador: Indicador | undefined): number | null {
  return tieneValor(indicador) && indicador?.unidad === 'PORCENTAJE' && indicador.valor !== null
    ? indicador.valor
    : null
}

function fondoAnillo(valor: number): string {
  return `conic-gradient(#125ccc 0% ${valor}%, #ffc533 ${valor}% 100%)`
}

function textoValor(indicador: Indicador | undefined): string {
  if (tieneValor(indicador) && indicador?.valor != null) {
    return formatearValor(indicador.valor, indicador.unidad)
  }

  if (indicador?.estado === 'PENDIENTE_REVISION') {
    return 'En revisión'
  }

  if (indicador?.estado === 'INFORMACION_INSUFICIENTE') {
    return 'Información insuficiente'
  }

  return 'No disponible'
}

function filaGrupo(etiqueta: string, respuesta: PromiseSettledResult<ResumenEstadisticas>): Fila {
  if (respuesta.status === 'rejected') {
    return {
      etiqueta,
      valor: null,
      estado: 'ERROR',
      mensaje: 'No fue posible consultar este grupo.',
    }
  }

  const indicador = respuesta.value.indicadores.find((elemento) => elemento.codigo === ACTIVIDAD)
  const valido = tieneValor(indicador) && indicador?.unidad === 'PORCENTAJE'
  const muestra = indicador?.muestra
  const mensajeMuestra =
    valido && typeof muestra === 'number' && Number.isInteger(muestra) && muestra >= 0
      ? `${new Intl.NumberFormat('es-CO').format(muestra)} registros con respuesta válida.`
      : ''

  return {
    etiqueta,
    valor: valido ? (indicador?.valor ?? null) : null,
    estado: valido
      ? 'DISPONIBLE'
      : indicador?.estado === 'DISPONIBLE'
        ? 'NO_DISPONIBLE'
        : (indicador?.estado ?? 'NO_DISPONIBLE'),
    mensaje: [mensajeMuestra, indicador?.mensaje].filter(Boolean).join(' ') || null,
  }
}

/* -----------------------------------------
   Periodos disponibles
----------------------------------------- */

async function cargarPeriodos(): Promise<void> {
  cargandoPeriodos.value = true
  errorPeriodos.value = ''

  try {
    const disponibles = await listarPeriodosPublicados()

    periodos.value = [...disponibles].sort((a, b) => b.anio - a.anio || b.trimestre - a.trimestre)

    periodoId.value = periodos.value[0]?.id ?? null

    if (periodoId.value !== null) {
      await consultarTablero()
    }
  } catch (error) {
    errorPeriodos.value =
      error instanceof Error ? error.message : 'No fue posible consultar los periodos.'
  } finally {
    cargandoPeriodos.value = false
  }
}

/* -----------------------------------------
   Consulta del tablero
----------------------------------------- */

async function consultarTablero(): Promise<void> {
  const periodo = periodos.value.find((elemento) => elemento.id === periodoId.value)

  if (!periodo || consultando.value) {
    return
  }

  const filtros: FiltrosEstadisticas = {
    anio: periodo.anio,
    trimestre: periodo.trimestre,
    edad: edad.value,
    sexo: sexo.value,
  }

  const anios = periodos.value
    .filter((elemento) => elemento.trimestre === periodo.trimestre && elemento.anio <= periodo.anio)
    .map((elemento) => elemento.anio)

  const desde = Math.max(periodo.anio - 30, Math.min(...anios))

  const consulta = ++numeroConsulta

  filtrosAplicados.value = filtros

  resumen.value = null

  filasEdad.value = []
  filasSexo.value = []
  filasAnio.value = []
  avisoComparacionAnual.value = ''

  errorResumen.value = ''
  consultando.value = true

  const gruposEdad = [
    { etiqueta: '5 a 14 años', valor: '5_14' as Edad },
    { etiqueta: '15 a 17 años', valor: '15_17' as Edad },
  ].filter((grupo) => filtros.edad === 'TODAS' || grupo.valor === filtros.edad)

  const gruposSexo = [
    { etiqueta: 'Masculino', valor: 'MASCULINO' as Sexo },
    { etiqueta: 'Femenino', valor: 'FEMENINO' as Sexo },
    { etiqueta: 'Sin dato de sexo', valor: 'SIN_DATO' as Sexo },
  ].filter((grupo) => filtros.sexo === 'TODOS' || grupo.valor === filtros.sexo)

  const [principal, edades, sexos, comparacion] = await Promise.allSettled([
    consultarEstadisticas(filtros),
    Promise.allSettled(
      gruposEdad.map((grupo) => consultarEstadisticas({ ...filtros, edad: grupo.valor })),
    ),
    Promise.allSettled(
      gruposSexo.map((grupo) => consultarEstadisticas({ ...filtros, sexo: grupo.valor })),
    ),
    compararEstadisticas(filtros, ACTIVIDAD, desde, periodo.anio),
  ] as const)

  if (consulta !== numeroConsulta) {
    return
  }

  if (principal.status === 'fulfilled') {
    resumen.value = principal.value
  } else {
    errorResumen.value = 'No fue posible consultar los indicadores. Intenta nuevamente.'
  }

  if (edades.status === 'fulfilled') {
    filasEdad.value = edades.value.map((respuesta, indice) =>
      filaGrupo(gruposEdad[indice]!.etiqueta, respuesta),
    )
  }

  if (sexos.status === 'fulfilled') {
    filasSexo.value = sexos.value
      .map((respuesta, indice) => filaGrupo(gruposSexo[indice]!.etiqueta, respuesta))
      .filter(
        (fila) =>
          fila.etiqueta !== 'Sin dato de sexo' ||
          filtros.sexo === 'SIN_DATO' ||
          fila.estado === 'DISPONIBLE' ||
          fila.estado === 'ERROR',
      )
  }

  if (comparacion.status === 'fulfilled') {
    const datos = comparacion.value as ComparacionEstadisticas & { advertencia?: string | null }
    avisoComparacionAnual.value = datos.advertencia ? advertenciaClara(datos.advertencia) : ''
    filasAnio.value = comparacion.value.puntos.map((punto) => ({
      etiqueta: String(punto.anio),
      valor: punto.valor,
      estado: punto.estado,
      mensaje: punto.mensaje,
    }))
  } else {
    filasAnio.value = [
      {
        etiqueta: 'Comparación',
        valor: null,
        estado: 'ERROR',
        mensaje: 'No fue posible consultar los años.',
      },
    ]
  }

  consultando.value = false
}

onMounted(() => {
  void cargarPeriodos()
})
</script>

<template>
  <div class="pagina pagina-inicio">
    <!-- Encabezado -->

    <header class="cabecera">
      <div class="contenedor cabecera__contenido">
        <RouterLink to="/" class="identidad" aria-label="Ir al inicio">
          <span class="identidad__simbolo" aria-hidden="true">P</span>

          <span>
            <strong>Trabajo <span class="marca-amarilla">Infantil</span></strong>
            <small>Información estadística · Pasto</small>
          </span>
        </RouterLink>

        <RouterLink v-if="sesion === 'inactiva'" :to="{ name: 'ingresar' }" class="acceso">
          Acceso administrativo
        </RouterLink>

        <RouterLink v-else :to="{ name: 'administracion' }" class="acceso">
          {{ sesion === 'activa' ? 'Mi panel' : 'Administración' }}
        </RouterLink>
      </div>
    </header>

    <main>
      <!-- Portada -->

      <section class="portada">
        <div class="contenedor portada__contenido">
          <div>
            <span class="portada__etiqueta"> Información para la ciudadanía </span>

            <h1>Conozcamos la información sobre trabajo infantil en Pasto</h1>

            <p>Consulta los datos disponibles y compáralos por edad, sexo y periodo.</p>
          </div>

          <div class="portada__fuente">
            <span>FUENTE DE INFORMACIÓN</span>
            <strong>Encuesta DANE</strong>
            <small>Pasto, Nariño</small>
          </div>
        </div>
      </section>

      <div class="contenedor contenido">
        <!-- Filtros -->

        <section class="filtros" aria-labelledby="titulo-filtros">
          <div class="seccion-titulo">
            <div>
              <span class="eyebrow">PERSONALIZA TU CONSULTA</span>
              <h2 id="titulo-filtros">Explora los datos</h2>
            </div>

            <div class="filtros__acciones">
              <span class="filtros__nota">Solo periodos publicados</span>
              <RouterLink :to="{ name: 'comparacion' }" class="enlace-comparacion">
                Comparar años <span aria-hidden="true">→</span>
              </RouterLink>
            </div>
          </div>

          <p v-if="cargandoPeriodos" class="aviso" role="status">Consultando periodos...</p>

          <div v-else-if="errorPeriodos" class="aviso" role="alert">
            {{ errorPeriodos }}

            <button type="button" class="enlace-boton" @click="cargarPeriodos">Reintentar</button>
          </div>

          <p v-else-if="periodos.length === 0" class="aviso">Aún no hay resultados publicados.</p>

          <form v-else class="filtros__formulario" @submit.prevent="consultarTablero">
            <label>
              Periodo

              <select v-model.number="periodoId" :disabled="consultando">
                <option v-for="periodo in periodos" :key="periodo.id" :value="periodo.id">
                  {{ periodo.anio }} · {{ nombreTrimestre(periodo.trimestre) }}
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
                <option value="TODOS">Todos</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMENINO">Femenino</option>
                <option value="SIN_DATO">Sin dato</option>
              </select>
            </label>

            <button class="boton" type="submit" :disabled="consultando">
              {{ consultando ? 'Consultando...' : 'Aplicar filtros' }}
            </button>
          </form>

          <p v-if="filtrosPendientes" class="aviso" role="status">
            Cambiaste la selección. Pulsa «Aplicar filtros» para actualizar los resultados.
          </p>
        </section>

        <template v-if="filtrosAplicados">
          <!-- Resumen -->

          <div class="titulo-bloque">
            <div>
              <span class="eyebrow">PANORAMA GENERAL</span>
              <h2>Resultados del periodo</h2>
            </div>

            <span class="periodo">{{ etiquetaPeriodo }}</span>
          </div>

          <p class="grupo-aplicado">{{ etiquetaGrupo }}</p>

          <p v-if="consultando" class="aviso" role="status">Consultando los resultados...</p>

          <p v-else-if="errorResumen" class="aviso" role="alert">
            {{ errorResumen }}
          </p>

          <template v-else>
            <p v-if="resumen?.estado === 'NO_DISPONIBLE'" class="aviso">
              {{ resumen.mensaje || 'No hay resultados disponibles para esta selección.' }}
            </p>

            <div v-else class="tarjetas">
              <article class="tarjeta tarjeta--muestra">
                <span class="tarjeta__titulo">Registros analizados en Pasto</span>
                <strong class="tarjeta__valor">
                  {{ numeroRegistros(dato('POBLACION_EXPANDIDA_5_17')) }}
                </strong>
                <span class="tarjeta__detalle"
                  >Personas de la muestra en el grupo seleccionado</span
                >
              </article>

              <article v-for="tarjeta in tarjetasPrincipales" :key="tarjeta.codigo" class="tarjeta">
                <span class="tarjeta__titulo">
                  {{ tarjeta.titulo }}
                </span>

                <strong
                  class="tarjeta__valor"
                  :class="{
                    'tarjeta__valor--vacio': !tieneValor(dato(tarjeta.codigo)),
                  }"
                >
                  {{ textoValor(dato(tarjeta.codigo)) }}
                </strong>

                <span class="tarjeta__detalle">
                  {{ tarjeta.detalle }}
                </span>

                <span v-if="dato(tarjeta.codigo)?.mensaje" class="tarjeta__mensaje">
                  {{ dato(tarjeta.codigo)?.mensaje }}
                </span>
              </article>
            </div>

            <p class="nota-metodo">
              Los registros son la muestra analizada. Los porcentajes son estimaciones calculadas
              con los factores de expansión del DANE.
            </p>

            <div class="titulo-bloque">
              <div>
                <span class="eyebrow">UNA VISTA SENCILLA</span>
                <h2>¿Qué muestran las respuestas?</h2>
              </div>
            </div>

            <div class="distribuciones">
              <article v-for="grafica in distribuciones" :key="grafica.codigo" class="distribucion">
                <div>
                  <h3>{{ grafica.titulo }}</h3>
                  <p>{{ grafica.descripcion }}</p>
                </div>

                <template v-if="porcentaje(dato(grafica.codigo)) !== null">
                  <div
                    class="distribucion__anillo"
                    :style="{ background: fondoAnillo(porcentaje(dato(grafica.codigo)) ?? 0) }"
                    role="img"
                    :aria-label="`${grafica.afirmativo}: ${formatearValor(porcentaje(dato(grafica.codigo)) ?? 0, 'PORCENTAJE')}; ${grafica.negativo}: ${formatearValor(100 - (porcentaje(dato(grafica.codigo)) ?? 0), 'PORCENTAJE')}.`"
                  >
                    <div class="distribucion__centro">
                      <span>Resultado</span>
                      <strong>{{ textoValor(dato(grafica.codigo)) }}</strong>
                      <small>porcentaje estimado</small>
                    </div>
                  </div>
                  <div class="distribucion__leyenda">
                    <div>
                      <span
                        ><i class="punto punto--azul" aria-hidden="true"></i
                        >{{ grafica.afirmativo }}</span
                      >
                      <strong>{{ textoValor(dato(grafica.codigo)) }}</strong>
                    </div>
                    <div>
                      <span
                        ><i class="punto punto--amarillo" aria-hidden="true"></i
                        >{{ grafica.negativo }}</span
                      >
                      <strong>{{
                        formatearValor(100 - (porcentaje(dato(grafica.codigo)) ?? 0), 'PORCENTAJE')
                      }}</strong>
                    </div>
                  </div>
                  <p class="distribucion__pie">
                    Entre quienes tienen una respuesta válida para este indicador.
                  </p>
                </template>

                <p v-else class="distribucion__vacia">
                  {{ textoValor(dato(grafica.codigo)) }} para esta selección.
                </p>
                <p v-if="dato(grafica.codigo)?.mensaje" class="distribucion__pie">
                  {{ dato(grafica.codigo)?.mensaje }}
                </p>
              </article>
            </div>

            <!-- Comparación por edad y sexo -->

            <div class="titulo-bloque">
              <div>
                <span class="eyebrow">COMPARACIÓN ENTRE GRUPOS</span>
                <h2>Respuestas por edad y sexo</h2>
              </div>
            </div>

            <div class="graficas">
              <PanelComparativo
                titulo="Por edad"
                descripcion="Porcentaje estimado dentro de cada grupo de edad mostrado."
                unidad="PORCENTAJE"
                :filas="filasEdad"
              />

              <PanelComparativo
                titulo="Por sexo"
                descripcion="Porcentaje estimado dentro de cada grupo de sexo mostrado."
                unidad="PORCENTAJE"
                :filas="filasSexo"
              />
            </div>

            <!-- Comparación por años -->

            <div class="titulo-bloque">
              <div>
                <span class="eyebrow">COMPARACIÓN EN EL TIEMPO</span>
                <h2>Resultados hasta {{ filtrosAplicados.anio }}</h2>
              </div>
            </div>

            <p v-if="avisoComparacionAnual" class="nota-metodo" role="note">
              {{ avisoComparacionAnual }}
            </p>

            <PanelComparativo
              titulo="Respuestas afirmativas por año"
              :descripcion="`${nombreTrimestre(filtrosAplicados.trimestre)} · ${etiquetaGrupo}. Se muestran los años publicados hasta el periodo seleccionado.`"
              unidad="PORCENTAJE"
              :filas="filasAnio"
            />

            <!-- Educación e ingresos -->

            <div class="titulo-bloque">
              <div>
                <span class="eyebrow">OTROS INDICADORES</span>
                <h2>Educación e ingresos</h2>
              </div>
            </div>

            <div class="tarjetas tarjetas--adicionales">
              <article v-for="tarjeta in tarjetasAdicionales" :key="tarjeta.codigo" class="tarjeta">
                <span class="tarjeta__titulo">
                  {{ tarjeta.titulo }}
                </span>

                <strong
                  class="tarjeta__valor"
                  :class="{
                    'tarjeta__valor--vacio': !tieneValor(dato(tarjeta.codigo)),
                  }"
                >
                  {{ textoValor(dato(tarjeta.codigo)) }}
                </strong>

                <span class="tarjeta__detalle">
                  {{ tarjeta.detalle }}
                </span>

                <span v-if="dato(tarjeta.codigo)?.mensaje" class="tarjeta__mensaje">
                  {{ dato(tarjeta.codigo)?.mensaje }}
                </span>
              </article>
            </div>

            <details class="metodo">
              <summary>Sobre las cifras</summary>

              <p>
                Son estimaciones calculadas con los factores de expansión de la encuesta DANE. Los
                grupos con pocas respuestas pueden tener mayor incertidumbre.
              </p>
              <p>
                Las respuestas afirmativas sobre actividad laboral no representan por sí solas la
                tasa oficial de trabajo infantil.
              </p>
            </details>
          </template>
        </template>

        <!-- El mapa se conserva sin cambios -->

        <div class="mapa-contenedor">
          <MapaPasto />
        </div>
      </div>
    </main>

    <footer class="pie">
      <div class="contenedor">Información estadística de Pasto <span>·</span> Fuente: DANE</div>
    </footer>
  </div>
</template>

<style scoped>
.pagina {
  min-height: 100vh;
  background: #f5f6fa;
  color: #252b3c;
}

.cabecera {
  background: #292e69;
  color: #fff;
}

.cabecera__contenido {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.identidad {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: white;
  text-decoration: none;
}

.identidad__simbolo {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid #9298c4;
  border-radius: 12px;
  font-weight: 800;
}

.identidad strong,
.identidad small {
  display: block;
}

.identidad small {
  margin-top: 0.18rem;
  color: #d8dbef;
  font-size: 0.75rem;
}

.acceso {
  padding: 0.65rem 0.85rem;
  border: 1px solid #8f96c0;
  border-radius: 10px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
  text-decoration: none;
}

.acceso:hover {
  background: rgba(255, 255, 255, 0.1);
}

.portada {
  background: linear-gradient(120deg, #252a62, #394586);
  color: white;
}

.portada__contenido {
  min-height: 225px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2rem;
  padding-block: 2.4rem 4rem;
}

.portada__etiqueta,
.eyebrow {
  color: #5665a8;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.portada__etiqueta {
  color: #fbd071;
}

.portada h1 {
  max-width: 720px;
  margin: 0.75rem 0;
  font-size: clamp(1.8rem, 3.4vw, 2.8rem);
  line-height: 1.15;
}

.portada p {
  margin: 0;
  color: #e1e5f4;
  line-height: 1.6;
}

.portada__fuente {
  display: grid;
  gap: 0.45rem;
  min-width: 190px;
  padding: 1.15rem 1.3rem;
  border-left: 3px solid #f7bb47;
  border-radius: 0 12px 12px 0;
  background: rgba(255, 255, 255, 0.08);
}

.portada__fuente span {
  color: #e2e6fb;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.portada__fuente small {
  color: #e2e6fb;
}

.contenido {
  padding-bottom: 3rem;
}

.filtros {
  position: relative;
  margin-top: -2rem;
  padding: 1.4rem;
  border: 1px solid #e3e6ef;
  border-radius: 18px;
  background: white;
  box-shadow: 0 10px 30px rgba(30, 37, 79, 0.09);
}

.seccion-titulo,
.titulo-bloque {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 1rem;
}

.seccion-titulo h2,
.titulo-bloque h2 {
  margin: 0.35rem 0 0;
  color: #252b62;
  font-size: 1.3rem;
}

.filtros__nota,
.periodo {
  color: #58667d;
  font-size: 0.82rem;
}

.filtros__acciones {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}

.filtros__formulario {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr auto;
  align-items: end;
  gap: 1rem;
  margin-top: 1.2rem;
}

.filtros label {
  display: grid;
  gap: 0.45rem;
  color: #39435c;
  font-size: 0.83rem;
  font-weight: 700;
}

.filtros select {
  width: 100%;
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  border: 1px solid #cfd6e4;
  border-radius: 9px;
  background: white;
  color: #242c40;
}

.boton {
  min-height: 44px;
  padding: 0.6rem 1.1rem;
  border: 0;
  border-radius: 9px;
  background: #303875;
  color: white;
  font-weight: 700;
}

.boton:hover {
  background: #21295f;
}

.boton:disabled {
  opacity: 0.65;
  cursor: wait;
}

.titulo-bloque {
  margin: 2.5rem 0 1rem;
}

.grupo-aplicado {
  margin: -0.3rem 0 1rem;
  color: #58667d;
  font-size: 0.85rem;
}

.periodo {
  padding: 0.45rem 0.7rem;
  border-radius: 999px;
  background: #e8ebf5;
  color: #394477;
  font-weight: 700;
}

.tarjetas {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.tarjetas--adicionales {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tarjeta {
  min-height: 155px;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 1.25rem;
  border: 1px solid #e2e6ef;
  border-radius: 16px;
  background: white;
  box-shadow: 0 8px 24px rgba(33, 39, 82, 0.04);
}

.tarjeta__titulo {
  color: #46516a;
  font-size: 0.84rem;
  font-weight: 700;
}

.tarjeta__valor {
  margin-top: auto;
  color: #292f6a;
  font-size: clamp(1.1rem, 1.8vw, 1.65rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.tarjeta__valor--vacio {
  color: #657086;
  font-size: 1rem;
}

.tarjeta__detalle,
.tarjeta__mensaje {
  color: #667187;
  font-size: 0.78rem;
  line-height: 1.4;
}

.tarjeta__mensaje {
  color: #81531c;
}

.nota-metodo {
  margin: 1rem 0 0;
  color: #58657a;
  font-size: 0.82rem;
  line-height: 1.5;
}

.enlace-comparacion {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 42px;
  padding: 0.6rem 0.95rem;
  border: 1px solid #1265ce;
  border-radius: 9px;
  color: #06449d;
  background: #edf5ff;
  font-size: 0.9rem;
  font-weight: 700;
  text-decoration: none;
}

.enlace-comparacion:hover {
  background: #dcecff;
}
.enlace-comparacion:focus-visible {
  outline: 3px solid #f6bd2e;
  outline-offset: 3px;
}

.tarjeta--muestra {
  border-top: 4px solid #0d64d7;
}

.distribuciones {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.distribucion {
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border: 1px solid #d6e4f5;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(17, 57, 112, 0.05);
}

.distribucion h3 {
  margin: 0;
  color: #073b85;
  font-size: 1.1rem;
}
.distribucion p {
  margin: 0.4rem 0 0;
  color: #53647c;
  font-size: 0.86rem;
  line-height: 1.5;
}
.distribucion__anillo {
  display: grid;
  place-items: center;
  width: 190px;
  height: 190px;
  max-width: 100%;
  margin: 1.3rem auto;
  border-radius: 50%;
}
.distribucion__centro {
  display: grid;
  place-content: center;
  width: 136px;
  height: 136px;
  border-radius: 50%;
  background: #fff;
  text-align: center;
}
.distribucion__centro span,
.distribucion__centro small {
  color: #586b86;
  font-size: 0.75rem;
}
.distribucion__centro strong {
  color: #06449d;
  font-size: 1.5rem;
}
.distribucion__leyenda {
  display: grid;
  gap: 0.7rem;
  margin-top: auto;
}
.distribucion__leyenda > div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: #263e67;
  font-size: 0.85rem;
}
.distribucion__leyenda span {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.distribucion__leyenda strong {
  white-space: nowrap;
}
.punto {
  display: inline-block;
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.punto--azul {
  background: #125ccc;
}
.punto--amarillo {
  background: #ffc533;
}
.distribucion .distribucion__pie {
  margin-top: 1rem;
  font-size: 0.76rem;
}
.distribucion .distribucion__vacia {
  padding: 2.5rem 0;
  color: #58657a;
}

.graficas {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.aviso {
  margin: 1rem 0 0;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #eef1f8;
  color: #46516a;
  line-height: 1.5;
}

.enlace-boton {
  padding: 0;
  border: 0;
  background: none;
  color: #303875;
  font-weight: 700;
  text-decoration: underline;
}

.metodo {
  margin-top: 1.2rem;
  color: #58657a;
  font-size: 0.84rem;
  line-height: 1.5;
}

.metodo summary {
  color: #303875;
  font-weight: 700;
  cursor: pointer;
}

.mapa-contenedor {
  margin-top: 2.5rem;
}

.pie {
  padding: 1.4rem 0;
  border-top: 1px solid #e0e4ed;
  color: #687489;
  font-size: 0.82rem;
}

.pie span {
  margin-inline: 0.35rem;
}

@media (max-width: 900px) {
  .tarjetas,
  .tarjetas--adicionales {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filtros__formulario {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .portada__contenido {
    display: block;
  }

  .portada__fuente {
    display: none;
  }

  .graficas,
  .distribuciones {
    grid-template-columns: 1fr;
  }

  .filtros__formulario {
    grid-template-columns: 1fr;
  }

  .seccion-titulo,
  .titulo-bloque {
    align-items: start;
    flex-direction: column;
  }

  .identidad small {
    display: none;
  }

  .acceso {
    font-size: 0.75rem;
  }

  .tarjetas {
    gap: 0.7rem;
  }

  .tarjeta {
    padding: 1rem;
  }
}
</style>
