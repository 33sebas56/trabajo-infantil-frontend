<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { estadoSesion, iniciarSesion } from '../services/authService'

const route = useRoute()
const router = useRouter()

const correo = ref('')
const contrasena = ref('')
const mostrarContrasena = ref(false)

const enviando = ref(false)
const mensajeError = ref('')

const aviso = computed(() => {
  if (route.query.motivo === 'inactividad') {
    return 'Tu sesión terminó por inactividad. Inicia sesión nuevamente.'
  }

  if (route.query.motivo === 'sesion') {
    return 'Tu sesión ya no está disponible. Inicia sesión para continuar.'
  }

  if (route.query.motivo === 'sin-confirmar') {
    return (
      'No se pudo confirmar el cierre de sesión con el servidor. ' +
      'Revisa la conexión antes de volver a ingresar.'
    )
  }

  return ''
})

async function enviarFormulario(): Promise<void> {
  if (enviando.value) return

  mensajeError.value = ''
  enviando.value = true

  try {
    await iniciarSesion(correo.value.trim(), contrasena.value)

    contrasena.value = ''

    await router.replace({
      name: 'administracion',
    })
  } catch (error) {
    mensajeError.value = error instanceof Error ? error.message : 'No fue posible iniciar sesión.'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <div class="login-pagina">
    <main class="login-contenido">
      <RouterLink to="/" class="login-regresar"> ← Volver al inicio </RouterLink>

      <section class="login-tarjeta" aria-labelledby="login-titulo">
        <!-- Marca -->

        <RouterLink to="/" class="login-marca" aria-label="Trabajo infantil. Volver al inicio">
          <svg viewBox="0 0 76 58" fill="none" aria-hidden="true">
            <g stroke="white" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="38" cy="12" r="8" />
              <circle cx="14" cy="21" r="5.5" />
              <circle cx="62" cy="21" r="5.5" />

              <path
                d="M21 46c0-9 7-15 17-15s17 6 17 15H21ZM4 46c0-8 4-12 12-12 3 0 5 1 7 2M72 46c0-8-4-12-12-12-3 0-5 1-7 2"
              />

              <path d="M5 54c20-9 46-9 66 0" stroke="#ffc600" />
            </g>
          </svg>

          <strong> Trabajo <span>Infantil</span> </strong>

          <p>Juntos por una niñez con más oportunidades</p>
        </RouterLink>

        <!-- Formulario -->

        <div class="login-cuerpo">
          <span class="login-icono" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-1a8 8 0 0 1 16 0v1H4Z" />
            </svg>
          </span>

          <h1 id="login-titulo">Iniciar sesión</h1>

          <p class="login-descripcion">Acceso para administradores autorizados.</p>

          <p v-if="aviso" class="login-mensaje login-aviso" role="status">
            {{ aviso }}
          </p>

          <div v-if="estadoSesion === 'activa'" class="login-activa">
            <strong>Ya tienes una sesión activa.</strong>

            <p>Puedes regresar al panel de administración.</p>

            <RouterLink :to="{ name: 'administracion' }" class="login-boton">
              Ir a mi panel
            </RouterLink>
          </div>

          <form v-else class="login-formulario" @submit.prevent="enviarFormulario">
            <label for="correo"> Correo electrónico </label>

            <input
              id="correo"
              v-model.trim="correo"
              type="email"
              name="correo"
              autocomplete="username"
              placeholder="nombre@correo.com"
              :disabled="enviando"
              required
            />

            <label for="contrasena"> Contraseña </label>

            <div class="login-contrasena">
              <input
                id="contrasena"
                v-model="contrasena"
                :type="mostrarContrasena ? 'text' : 'password'"
                name="contrasena"
                autocomplete="current-password"
                placeholder="Escribe tu contraseña"
                :disabled="enviando"
                required
              />

              <button
                type="button"
                class="login-mostrar"
                :aria-pressed="mostrarContrasena"
                :aria-label="mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                :disabled="enviando"
                @click="mostrarContrasena = !mostrarContrasena"
              >
                {{ mostrarContrasena ? 'Ocultar' : 'Mostrar' }}
              </button>
            </div>

            <p v-if="mensajeError" class="login-mensaje login-error" role="alert">
              {{ mensajeError }}
            </p>

            <button type="submit" class="login-boton" :disabled="enviando">
              {{ enviando ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>

          <p class="login-ayuda">
            <strong>¿Olvidaste tu contraseña?</strong><br />

            Solicita ayuda a la persona responsable del sistema.
          </p>
        </div>
      </section>
    </main>

    <footer class="login-pie">Información estadística de Pasto · Fuente: DANE</footer>
  </div>
</template>
