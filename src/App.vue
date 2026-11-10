<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRouter } from 'vue-router'

import { iniciarControlSesion } from './services/controlSesion'

const router = useRouter()

let detenerControl: (() => void) | undefined

onMounted(() => {
  detenerControl = iniciarControlSesion((motivo) => {
    const ruta = router.currentRoute.value.name

    if (ruta === 'administracion' || ruta === 'comparacion-administracion') {
      void router.replace({
        name: 'ingresar',
        query: { motivo },
      })
    }
  })
})

onBeforeUnmount(() => {
  detenerControl?.()
})
</script>

<template>
  <RouterView />
</template>
