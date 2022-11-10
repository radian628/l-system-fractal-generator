import { mat4, vec3 } from 'gl-matrix';
import React from 'react';
import { useState } from 'react'
import './App.css'
import { MainCanvas } from './canvas/MainCanvas'
import { LSystemCodeEditor } from './code-editor/CodeEditor';
import { LSystemDSLCompilerOutput } from './code-editor/Compiler';
import { applyLSystem, iterateLSystem, LSystemApplication, LSystemSpecification, mapLSystemApplication, optimizeLSystemSpec } from './l-system/LSystemGenerator'

function App() {
    
    const [lSystem, setLSystem] = useState<LSystemDSLCompilerOutput>();

    return <React.Fragment>
        <LSystemCodeEditor onSuccessfulRecompile={o => {
            console.log(o);
            setLSystem(o);
        }}></LSystemCodeEditor>
        {lSystem && <MainCanvas
            lSystem={lSystem}
        ></MainCanvas>}
    </React.Fragment>
}

export default App
