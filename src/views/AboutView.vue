<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="sobre-pagina">
    <header class="sobre-cabecera">
      <div class="sobre-cabecera-interior">
        <RouterLink to="/" class="sobre-marca" aria-label="Ir al inicio">
          <span class="sobre-simbolo" aria-hidden="true"> P </span>

          <span>
            <strong> Trabajo <span class="marca-amarilla">Infantil</span> </strong>

            <small> Información estadística · Pasto </small>
          </span>
        </RouterLink>

        <RouterLink to="/" class="sobre-volver"> Volver al inicio </RouterLink>
      </div>
    </header>

    <main class="sobre-contenido">
      <section class="sobre-panel">
        <h1>Acerca del sistema</h1>

        <p>
          Este espacio permite consultar información estadística sobre la niñez y las respuestas
          relacionadas con actividad laboral en Pasto, a partir de los datos disponibles del DANE.
        </p>

        <h2>¿Qué puedes consultar?</h2>

        <ul>
          <li>Resultados por periodo, edad y sexo.</li>
          <li>Indicadores y comparaciones disponibles.</li>
          <li>Un mapa de referencia de Pasto.</li>
        </ul>

        <p>
          Los resultados por comuna requieren información que permita identificar esos sectores. La
          administración de archivos está reservada para las personas autorizadas.
        </p>

        <RouterLink :to="{ name: 'comparacion' }"> Explorar las comparaciones → </RouterLink>
      </section>
    </main>

    <footer class="sobre-pie">Información estadística de Pasto · Fuente: DANE</footer>
  </div>
</template>
