<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as L from 'leaflet'

import 'leaflet/dist/leaflet.css'

const contenedorMapa = ref<HTMLDivElement | null>(null)
const mensajeMapa = ref('')

let mapa: L.Map | null = null

/*
 * Ubicación general publicada por la Alcaldía:
 * 1°12'52.48" N, 77°16'41.22" O.
 *
 * La marca es únicamente una referencia geográfica.
 */
const ubicacionPasto: L.LatLngExpression = [1.21457778, -77.27811667]

onMounted(() => {
  if (!contenedorMapa.value) {
    return
  }

  try {
    mapa = L.map(contenedorMapa.value, {
      scrollWheelZoom: false,
    }).setView(ubicacionPasto, 12)

    const capa = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,

      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">' +
        'OpenStreetMap</a> contributors',
    })

    capa.on('tileerror', () => {
      mensajeMapa.value =
        'No se pudieron cargar algunas partes del mapa. Revisa la conexión a internet.'
    })

    capa.addTo(mapa)

    L.circleMarker(ubicacionPasto, {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#2b2c6b',
      fillOpacity: 1,
    })
      .addTo(mapa)
      .bindPopup(
        '<strong>Pasto, Nariño</strong><br>' +
          'Ubicación general de referencia.<br>' +
          'No representa casos ni cifras por sector.',
      )
  } catch {
    mensajeMapa.value = 'No fue posible mostrar el mapa en este momento.'
  }
})

onBeforeUnmount(() => {
  mapa?.remove()
  mapa = null
})
</script>

<template>
  <section class="mapa-seccion" aria-labelledby="titulo-mapa">
    <div class="mapa-seccion__texto">
      <span class="mapa-seccion__etiqueta">Referencia territorial</span>

      <h2 id="titulo-mapa">Ubicación de Pasto</h2>

      <p>
        Este mapa permite ubicar el municipio. La información estadística disponible no permite
        presentar resultados por comuna en esta vista.
      </p>
    </div>

    <div
      ref="contenedorMapa"
      class="mapa"
      aria-label="Mapa interactivo de referencia de Pasto, Nariño"
    ></div>

    <p v-if="mensajeMapa" class="mapa-seccion__mensaje" role="status">
      {{ mensajeMapa }}
    </p>

    <p class="mapa-seccion__nota">
      La marca es una referencia de ubicación, no representa casos de trabajo infantil. El mapa
      necesita conexión a internet.
    </p>
  </section>
</template>

<style scoped>
.mapa-seccion {
  padding: 1.5rem;

  border: 1px solid var(--color-borde);
  border-radius: var(--radio-mediano);
  background: var(--color-blanco);
  box-shadow: var(--sombra-suave);
}

.mapa-seccion__texto {
  margin-bottom: 1.2rem;
}

.mapa-seccion__etiqueta {
  display: block;
  margin-bottom: 0.5rem;

  color: var(--color-azul);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.mapa-seccion h2 {
  margin: 0 0 0.5rem;

  color: var(--color-azul);
  font-size: 1.2rem;
}

.mapa-seccion__texto p {
  max-width: 700px;
  margin: 0;

  color: var(--color-texto-suave);
  line-height: 1.6;
}

.mapa {
  z-index: 0;
  width: 100%;
  height: 340px;

  overflow: hidden;
  border: 1px solid var(--color-borde);
  border-radius: 12px;
  background: var(--color-fondo-suave);
}

.mapa-seccion__mensaje {
  margin: 1rem 0 0;
  color: var(--color-rojo);
  font-size: 0.86rem;
}

.mapa-seccion__nota {
  margin: 1rem 0 0;

  color: var(--color-texto-suave);
  font-size: 0.82rem;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .mapa-seccion {
    padding: 1.1rem;
  }

  .mapa {
    height: 280px;
  }
}
</style>
