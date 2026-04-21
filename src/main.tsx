import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'
import { initAutoSave } from './stores/rf-planner.store'

// T040: Start auto-saving project to localStorage on every store mutation
initAutoSave();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
