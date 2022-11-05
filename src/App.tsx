import { useState } from 'react'
import './App.css'
import { MainCanvas } from './canvas/MainCanvas'
import { iterateLSystem, LSystemSpecification, optimizeLSystemSpec } from './l-system/LSystemGenerator'

function App() {
    const optSpec = optimizeLSystemSpec({
        axiom: ["A"],
        substitutions: new Map([
            ["A", ["B"]],
            ["B", ["A", "B"]]
        ]),
        alphabet: ["A", "B"]
    });
    if (optSpec.ok) {
        console.log(iterateLSystem(optSpec.data.spec, 8));
    }
    return <MainCanvas></MainCanvas>
}

export default App
