<script setup lang="ts">
import { computed } from 'vue'

type Segmento = {
  nombre: string
  valor: number | null
  color: string
  mensaje?: string | null
}

const props = defineProps<{
  titulo: string
  descripcion: string
  total: number | null
  unidad: string
  segmentos: Segmento[]
  error?: string
}>()

function numeroValido(valor: number | null): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
}

const suma = computed(() => {
  return props.segmentos.reduce((total, segmento) => {
    return total + (numeroValido(segmento.valor) ? segmento.valor : 0)
  }, 0)
})

/*
 * La gráfica solo se dibuja si las cantidades disponibles
 * completan la base. Un dato ausente no se convierte en cero.
 */
const completo = computed(() => {
  if (props.error || !numeroValido(props.total) || props.total <= 0) {
    return false
  }

  const tolerancia = Math.max(0.000001, props.total * 0.0000001)

  return Math.abs(suma.value - props.total) <= tolerancia
})

const fondo = computed(() => {
  if (!completo.value || !numeroValido(props.total)) {
    return ''
  }

  let acumulado = 0

  const trozos = props.segmentos
    .filter((segmento) => {
      return numeroValido(segmento.valor) && segmento.valor > 0
    })
    .map((segmento) => {
      const inicio = acumulado

      acumulado += ((segmento.valor ?? 0) / (props.total ?? 1)) * 100

      return segmento.color + ' ' + inicio + '% ' + acumulado + '%'
    })

  return 'conic-gradient(' + trozos.join(', ') + ')'
})

function cantidad(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(valor)
}

function porcentaje(valor: number | null): string {
  if (!completo.value || !numeroValido(valor) || !numeroValido(props.total) || props.total === 0) {
    return ''
  }

  const resultado = (valor * 100) / props.total

  if (resultado > 0 && resultado < 0.1) {
    return '< 0,1 %'
  }

  return (
    new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 1,
    }).format(resultado) + ' %'
  )
}
</script>

<template>
  <section class="tarjeta-grafico">
    <div class="encabezado">
      <span class="etiqueta">COMPOSICIÓN</span>
      <h3>{{ titulo }}</h3>
      <p>{{ descripcion }}</p>
    </div>

    <p v-if="error" class="aviso" role="alert">
      {{ error }}
    </p>

    <div v-else class="contenido">
      <div
        v-if="completo && total !== null"
        class="anillo"
        :style="{ background: fondo }"
        role="img"
        :aria-label="
          titulo +
          '. Base: ' +
          cantidad(total) +
          ' ' +
          unidad +
          '. Consulta el detalle en la leyenda.'
        "
      >
        <div class="centro">
          <span>Base</span>
          <strong>{{ cantidad(total) }}</strong>
          <small>{{ unidad }}</small>
        </div>
      </div>

      <div v-else class="sin-grafico">
        <strong>Gráfico no disponible</strong>

        <span> No hay datos suficientes y consistentes para completar esta distribución. </span>
      </div>

      <ul class="leyenda">
        <li v-for="segmento in segmentos" :key="segmento.nombre">
          <span class="punto" :style="{ background: segmento.color }" aria-hidden="true"></span>

          <div>
            <span class="nombre">
              {{ segmento.nombre }}
            </span>

            <small v-if="segmento.mensaje">
              {{ segmento.mensaje }}
            </small>
          </div>

          <div class="valor">
            <strong>
              {{ numeroValido(segmento.valor) ? cantidad(segmento.valor ?? 0) : 'No disponible' }}
            </strong>

            <small v-if="porcentaje(segmento.valor)">
              {{ porcentaje(segmento.valor) }}
            </small>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.tarjeta-grafico {
  min-width: 0;
  padding: 1.4rem;
  border: 1px solid #e2e6ef;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(33, 39, 82, 0.05);
}

.etiqueta {
  color: #5665a8;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.encabezado h3 {
  margin: 0.45rem 0;
  color: #252b62;
  font-size: 1.08rem;
}

.encabezado p {
  min-height: 2.6em;
  margin: 0;
  color: #58657a;
  font-size: 0.84rem;
  line-height: 1.5;
}

.contenido {
  display: grid;
  gap: 1.35rem;
  margin-top: 1.2rem;
}

.anillo {
  width: min(190px, 65%);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  margin: 0 auto;
  border-radius: 50%;
}

.centro {
  width: 67%;
  height: 67%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding: 0.3rem;
  border-radius: 50%;
  background: white;
  text-align: center;
}

.centro span,
.centro small {
  color: #667187;
  font-size: 0.68rem;
  line-height: 1.2;
}

.centro strong {
  color: #252b62;
  font-size: 1.35rem;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.leyenda {
  display: grid;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.leyenda li {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.55rem;
  font-size: 0.82rem;
}

.punto {
  width: 10px;
  height: 10px;
  margin-top: 0.3rem;
  border-radius: 50%;
}

.nombre {
  color: #39435c;
  font-weight: 700;
}

.leyenda small {
  display: block;
  margin-top: 0.2rem;
  color: #687489;
  font-size: 0.73rem;
  line-height: 1.4;
}

.valor {
  color: #252b62;
  text-align: right;
}

.valor strong {
  font-size: 0.82rem;
}

.aviso,
.sin-grafico {
  padding: 1rem;
  border-radius: 12px;
  background: #f3f5fa;
  color: #58657a;
  font-size: 0.83rem;
  line-height: 1.5;
}

.sin-grafico {
  min-height: 120px;
  display: grid;
  align-content: center;
  gap: 0.3rem;
  text-align: center;
}

.sin-grafico strong {
  color: #394477;
}
</style>
