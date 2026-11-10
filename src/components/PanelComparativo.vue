<script setup lang="ts">
import { computed } from 'vue'

import { formatearValor } from '../services/estadisticasService'

type Fila = {
  etiqueta: string
  valor: number | null
  estado: string
  mensaje: string | null
}

const props = defineProps<{
  titulo: string
  descripcion: string
  unidad: string
  filas: Fila[]
}>()

function disponible(fila: Fila): boolean {
  return (
    fila.estado === 'DISPONIBLE' &&
    typeof fila.valor === 'number' &&
    Number.isFinite(fila.valor) &&
    fila.valor >= 0
  )
}

const maximo = computed(() => {
  const valores = props.filas.filter(disponible).map((fila) => fila.valor ?? 0)

  return valores.length ? Math.max(...valores) : null
})

function ancho(fila: Fila): string {
  if (!disponible(fila) || maximo.value === null || maximo.value === 0) {
    return '0%'
  }

  return `${((fila.valor ?? 0) / maximo.value) * 100}%`
}

function nombreEstado(estado: string): string {
  if (estado === 'NO_COMPARABLE') {
    return 'No comparable'
  }

  if (estado === 'PENDIENTE_REVISION') {
    return 'En revisión'
  }

  if (estado === 'INFORMACION_INSUFICIENTE') {
    return 'Información insuficiente'
  }

  if (estado === 'ERROR') {
    return 'No se pudo consultar'
  }

  return 'No disponible'
}
</script>

<template>
  <section class="panel-grafica">
    <div class="panel-grafica__encabezado">
      <h3>{{ titulo }}</h3>
      <p>{{ descripcion }}</p>
    </div>

    <p v-if="maximo !== null" class="panel-grafica__escala">
      Escala: 0 a {{ formatearValor(maximo, unidad) }}
    </p>

    <ul class="barras">
      <li v-for="fila in filas" :key="fila.etiqueta" class="barra">
        <div class="barra__encabezado">
          <span>{{ fila.etiqueta }}</span>

          <strong v-if="disponible(fila)">
            {{ formatearValor(fila.valor ?? 0, unidad) }}
          </strong>

          <strong v-else class="barra__sin-dato">
            {{ nombreEstado(fila.estado) }}
          </strong>
        </div>

        <div v-if="disponible(fila)" class="barra__pista" aria-hidden="true">
          <div class="barra__relleno" :style="{ width: ancho(fila) }"></div>
        </div>

        <p v-if="fila.mensaje" class="barra__mensaje">
          {{ fila.mensaje }}
        </p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.panel-grafica {
  height: 100%;
  padding: 1.5rem;
  border: 1px solid #e2e6f0;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(33, 39, 82, 0.05);
}

.panel-grafica__encabezado h3 {
  margin: 0 0 0.4rem;
  color: #222858;
  font-size: 1.1rem;
}

.panel-grafica__encabezado p,
.panel-grafica__escala,
.barra__mensaje {
  margin: 0;
  color: #596579;
  font-size: 0.85rem;
  line-height: 1.5;
}

.panel-grafica__escala {
  margin: 1.1rem 0;
  font-size: 0.75rem;
}

.barras {
  display: grid;
  gap: 1.25rem;
  margin: 1.1rem 0 0;
  padding: 0;
  list-style: none;
}

.barra__encabezado {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  font-size: 0.9rem;
}

.barra__encabezado strong {
  color: #252d6b;
  text-align: right;
  white-space: nowrap;
}

.barra__encabezado .barra__sin-dato {
  color: #596579;
  font-size: 0.82rem;
  white-space: normal;
}

.barra__pista {
  height: 9px;
  margin-top: 0.55rem;
  border-radius: 20px;
  background: #ebedf5;
  overflow: hidden;
}

.barra__relleno {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #3a438f, #6874c7);
}

.barra__mensaje {
  margin-top: 0.35rem;
  font-size: 0.78rem;
}
</style>
