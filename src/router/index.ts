import { createRouter, createWebHistory } from 'vue-router'

import HomeView from '../views/HomeView.vue'
import LoginView from '../views/LoginView.vue'
import AdministracionView from '../views/AdministracionView.vue'
import ComparacionView from '../views/ComparacionView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),

  routes: [
    {
      path: '/',
      name: 'inicio',
      component: HomeView,
    },
    {
      path: '/ingresar',
      name: 'ingresar',
      component: LoginView,
    },
    {
      path: '/administracion',
      name: 'administracion',
      component: AdministracionView,
    },
    {
      path: '/comparacion',
      name: 'comparacion',
      component: ComparacionView,
    },
    {
      path: '/administracion/comparacion',
      redirect: { name: 'comparacion' },
    },
  ],

  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
