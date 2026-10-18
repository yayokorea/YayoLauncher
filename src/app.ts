import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import '@fortawesome/fontawesome-free/css/brands.min.css'
import './static/styles/_variables.scss'
import './static/styles/main.scss'
import './static/styles/loading.scss'
import './static/styles/login.scss'
import './static/styles/home.scss'
import './static/styles/settings.scss'
import './static/styles/maintenance.scss'
import './static/styles/update.scss'
import './static/styles/dialog.scss'

import { mount } from 'svelte'
import App from './App.svelte'

mount(App, { target: document.getElementById('app-root')! })
