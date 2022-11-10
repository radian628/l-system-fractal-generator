import { useEffect, useRef, useState } from "react";
import { err, ok, Result } from "../webgl-helpers/Common";
import GEN_VERT_SHADER from "./l-system-generation.vert?raw";
import GEN_FRAG_SHADER from "./l-system-generation.frag?raw";
import DISP_VERT_SHADER from "./l-system-display.vert?raw";
import DISP_FRAG_SHADER from "./l-system-display.frag?raw";
import { bindProgram, getProgramFromStrings, Matrix4, setUniforms } from "../webgl-helpers/Shader";
import { bindBuffer, bindBufferBase, bufferData, createBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { bindVertexArray, createVertexArray } from "../webgl-helpers/VertexArray";
import { applyLSystem, iterateLSystem, LSystemApplication, mapLSystemApplication, optimizeAndApplyLSystem, optimizeLSystemSpec } from "../l-system/LSystemGenerator";
import { mat4, vec3 } from "gl-matrix";
import { bindTransformFeedback } from "../webgl-helpers/TransformFeedback";
import { transform } from "typescript";
import { cubeIndices, cubeVertices } from "./VertexData";
import { deindex } from "../webgl-helpers/WebGLUtils";
import { LSystemBufferData, LSystemToBuffers } from "../l-system/LSystemToBuffers";
import { compile } from "../code-editor/Compiler";
import { sampleCode } from "../code-editor/CodeEditor";

export function useUpToDate<T>(state: T) {
    const ref = useRef<T>(state);

    useEffect(() => {
        ref.current = state;
    }, [state]);

    return [ref.current, ref];
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


function createWebGLState(gl: WebGL2RenderingContext): Result<WebGLState, string> {
    const tf = gl.createTransformFeedback();
    if (!tf) return err("Failed to create transform feedback.");
    const genProgram = getProgramFromStrings(gl, GEN_VERT_SHADER, GEN_FRAG_SHADER, {
        varyings: ["pos", "normal"],
        bufferMode: gl.INTERLEAVED_ATTRIBS
    });
    if (!genProgram.ok) return err("Failed to create shader program.");

    const dispProgram = getProgramFromStrings(gl, DISP_VERT_SHADER, DISP_FRAG_SHADER);
    if (!dispProgram.ok) return err("Failed to create shader program.");

    const deindexedCubeVertices = new Float32Array(deindex(cubeVertices, cubeIndices, 4 * 6));

    const deindexedCubeBuffer = createBufferWithData(gl, deindexedCubeVertices, gl.STATIC_DRAW);
    if (!deindexedCubeBuffer.ok) return err("Failed to create deindexed cube buffer");

    const compiledLSys = compile(sampleCode);
    if (!compiledLSys.ok) return err(JSON.stringify(compiledLSys.data));

    const lsbd = LSystemToBuffers(
        gl,
        {
            meshGenProgram: genProgram.data,
            meshDisplayProgram: dispProgram.data,
            cubeBuffer: deindexedCubeBuffer.data,
            tf
        },
        compiledLSys.data.spec,
        compiledLSys.data.app,
        5,
        5
    );
    if (!lsbd.ok) return err("Failed to convert L system to buffers.");

    return ok({
        gl,
        program: dispProgram.data,

        lSystemBufferData: lsbd.data
    });
}



export function useWebGLState(
    canvasRef: React.RefObject<HTMLCanvasElement>, 
    callback: (time: number, gls: WebGLState) => void
): {
    glStatus: Result<undefined, string>,
    windowSize: [number, number]
} {
    const stateRef = useRef<WebGLState>();
    const [webGLError, setWebGLError] = useState<Result<undefined, string>>(ok(undefined));

    const [windowSize, setWindowSize] = useState<[number, number]>([window.innerWidth, window.innerHeight]);

    useEffect(() => {
        window.addEventListener("resize", e => {
            stateRef.current = undefined;
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        });
    })

    useAnimationFrame((time) => {
        const gl = canvasRef.current?.getContext("webgl2");
        if (!gl) return setWebGLError(err("Failed to create WebGL context."));

        if (!stateRef.current) {
            const state = createWebGLState(gl);

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