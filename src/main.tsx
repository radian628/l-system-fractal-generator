import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { MainCanvas } from './canvas/MainCanvas'
import './index.css'
import './code-editor/CodeEditor.css'
import { initCodeEditor } from "./code-editor/CodeEditor"

initCodeEditor();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MainCanvas></MainCanvas>
  </React.StrictMode>
)
