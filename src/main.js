import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import { App } from './app/App.js'

const app = new App({
  canvas: document.getElementById('stage'),
  tags: document.getElementById('tags'),
  ui: document.getElementById('ui'),
})
app.boot()
window.__agenthq = app // handy for debugging and screenshot scripts
