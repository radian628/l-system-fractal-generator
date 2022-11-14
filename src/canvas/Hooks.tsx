import { useEffect, useRef, useState } from "react";
import { err, ok, Result } from "../webgl-helpers/Common";
import GEN_VERT_SHADER from "./l-system-generation.vert?raw";
import GEN_FRAG_SHADER from "./l-system-generation.frag?raw";
import DISP_VERT_SHADER from "./l-system-display.vert?raw";
import DISP_FRAG_SHADER from "./l-system-display.frag?raw";
import { bindProgram, getProgramFromStrings, Matrix4, setUniforms } from "../webgl-helpers/Shader";
import { bindBuffer, bindBufferBase, bufferData, createBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { cubeIndices, cubeVertices } from "./VertexData";
import { deindex } from "../webgl-helpers/WebGLUtils";
import { LSystemBufferData, LSystemToBuffers } from "../l-system/LSystemToBuffers";
import { compile, LSystemDSLCompilerOutput } from "../code-editor/Compiler";
import { getIteratedLSystemDrawCount, getIteratedLSystemLength } from "../l-system/LSystemGenerator";

export function useUpToDate<T>(state: T) {
    const ref = useRef<T>(state);

    useEffect(() => {
        ref.current = state;
    }, [state]);

    return [ref.current, ref] as const;
}

export function useAnimationFrame(callback: (time: number) => void) {

    const animFrameRef = useRef<number>(-1);
    const prevTimeRef = useRef<number>(0);

    const animate = (time: number) => {
        if (prevTimeRef.current) {
            const dt = time - prevTimeRef.current;
            callback(dt);
        }
        prevTimeRef.current = time;
        animFrameRef.current = requestAnimationFrame(animate);
    }

    useEffect(() => {
        animFrameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, []);
}

type WebGLState = {
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    lSystemBufferData: LSystemBufferData
}


function createWebGLState(
    gl: WebGL2RenderingContext,     
    options: {
        lSystem: LSystemDSLCompilerOutput
    },
    genProgram: WebGLProgram,
    dispProgram: WebGLProgram
): Result<WebGLState, string> {
    const tf = gl.createTransformFeedback();
    if (!tf) return err("Failed to create transform feedback.");

    const deindexedCubeVertices = new Float32Array(deindex(cubeVertices, cubeIndices, 4 * 6));

    const deindexedCubeBuffer = createBufferWithData(gl, deindexedCubeVertices, gl.STATIC_DRAW);
    if (!deindexedCubeBuffer.ok) return err("Failed to create deindexed cube buffer");

    const compiledLSys = options.lSystem;
    //if (!compiledLSys.ok) return err(JSON.stringify(compiledLSys.data));


    let iterations = 1;
    while (getIteratedLSystemDrawCount(compiledLSys.spec, compiledLSys.app, iterations) < 100_000 && iterations < 30) {
        iterations++;
    }

    const lsbd = LSystemToBuffers(
        gl,
        {
            meshGenProgram: genProgram,
            meshDisplayProgram: dispProgram,
            cubeBuffer: deindexedCubeBuffer.data,
            tf
        },
        compiledLSys.spec,
        compiledLSys.app,
        Math.floor(iterations / 2),
        iterations - Math.floor(iterations / 2)
    );
    if (!lsbd.ok) return err("Failed to convert L system to buffers.");

    return ok({
        gl,
        program: dispProgram,

        lSystemBufferData: lsbd.data
    });
}



export function useWebGLState(
    canvasRef: React.RefObject<HTMLCanvasElement | undefined>, 
    options: {
        lSystem: LSystemDSLCompilerOutput
    },
    callback: (time: number, gls: WebGLState) => void
): {
    glStatus: Result<undefined, string>,
    windowSize: [number, number]
} {
    const stateRef = useRef<WebGLState>();
    const [webGLError, setWebGLError] = useState<Result<undefined, string>>(ok(undefined));

    const [windowSize, setWindowSize] = useState<[number, number]>([window.innerWidth, window.innerHeight]);

    const [, optionsUpToDate] = useUpToDate(options);

    useEffect(() => {
        stateRef.current = undefined;
    }, [options.lSystem]);

    useEffect(() => {
        window.addEventListener("resize", e => {
            if (!canvasRef.current) return;
            stateRef.current = undefined;
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        });
    });

    const genProgramRef = useRef<WebGLProgram>();
    const dispProgramRef = useRef<WebGLProgram>();

    useAnimationFrame((time) => {
        const gl = canvasRef.current?.getContext("webgl2");
        if (!gl) return setWebGLError(err("Failed to create WebGL context."));

        if (!genProgramRef.current) {
            const genProgram = getProgramFromStrings(gl, GEN_VERT_SHADER, GEN_FRAG_SHADER, {
                varyings: ["pos", "normal"],
                bufferMode: gl.INTERLEAVED_ATTRIBS
            });
            if (!genProgram.ok) return;
            genProgramRef.current = genProgram.data;
            return;
        }
        
        if (!dispProgramRef.current) {
            const dispProgram = getProgramFromStrings(gl, DISP_VERT_SHADER, DISP_FRAG_SHADER);
            if (!dispProgram.ok) return;
            dispProgramRef.current = dispProgram.data;
            return;
        }

        if (!stateRef.current) {
            const state = createWebGLState(gl, optionsUpToDate.current, genProgramRef.current, dispProgramRef.current);

            if (!state.ok) return setWebGLError(err(state.data));

            stateRef.current = state.data;
        }
        callback(time, stateRef.current);
    });
    return {
        glStatus: webGLError,
        windowSize
    };
}