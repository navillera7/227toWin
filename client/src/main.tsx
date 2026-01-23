import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App' // KoreanElectionPredictor가 아니라 App이어야 함
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)