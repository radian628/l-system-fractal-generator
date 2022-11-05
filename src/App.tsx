import { mat4, vec3 } from 'gl-matrix';
import { useState } from 'react'
import './App.css'
import { MainCanvas } from './canvas/MainCanvas'
import { applyLSystem, iterateLSystem, LSystemApplication, LSystemSpecification, mapLSystemApplication, optimizeLSystemSpec } from './l-system/LSystemGenerator'

function App() {
    
    return <MainCanvas></MainCanvas>
}

export default App
