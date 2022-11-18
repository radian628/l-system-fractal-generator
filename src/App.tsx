import { mat4, vec3 } from 'gl-matrix';
import React, { useEffect } from 'react';
import { useState } from 'react'
import './App.css'
import { MainCanvas } from './canvas/MainCanvas'
import { ast } from './code-editor/ASTGenerator';
import { LSystemCodeEditor } from './code-editor/CodeEditor';
import { compileAST, CompilerError, LSystemDSLCompilerOutput } from './code-editor/Compiler';
import { applyLSystem, iterateLSystem, LSystemApplication, LSystemSpecification, mapLSystemApplication, optimizeLSystemSpec } from './l-system/LSystemGenerator'

function App() {
    
    const [lSystem, setLSystem] = useState<LSystemDSLCompilerOutput>();
    const [lSystemAST, setLSystemAST] = useState<ast.Root<ast.Range>>();
    const [modifiedConstants, setModifiedConstants] = useState<Map<string, number>>(new Map());

    const [additionalErrors, setAdditionalErrors] = useState<CompilerError[]>([]);

    const [segments, setSegments] = useState(10_000);

    useEffect(() => {
        setModifiedConstants(new Map());
    }, [lSystemAST]);

    useEffect(() => {
        if (!lSystemAST) return;
        const compiledAST = compileAST(lSystemAST, modifiedConstants);
        if (compiledAST.ok) {
            setLSystem(compiledAST.data);
            setAdditionalErrors([]);
        } else {
            setAdditionalErrors(compiledAST.data);
        }
    }, [lSystemAST, modifiedConstants]);

    return <React.Fragment>
        <LSystemCodeEditor 
            lastSuccessfulLSystem={lSystemAST}
            onSuccessfulRecompile={o => {
                console.log(o);
                setLSystemAST(o);
            }}
            additionalErrors={additionalErrors}
            setLSystem={setLSystem}
            setAdditionalErrors={setAdditionalErrors}
            modifiedConstants={modifiedConstants}
            setModifiedConstants={setModifiedConstants}
            segments={segments}
            setSegments={setSegments}
        ></LSystemCodeEditor>
        {lSystem && <MainCanvas
            lSystem={lSystem}
            segments={segments}
        ></MainCanvas>}
    </React.Fragment>
}

export default App
