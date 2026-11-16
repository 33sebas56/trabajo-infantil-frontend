import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import './assets/main.css'
import './assets/identidad-institucional.css'
import './assets/identidad-cieti.css'

import './assets/main.css'

const app = createApp(App)

app.use(router)

app.mount('#app')
