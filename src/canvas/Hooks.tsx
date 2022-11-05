import { useEffect, useRef, useState } from "react";
import { err, ok, Result } from "../webgl-helpers/Common";
import VERT_SHADER from "./l-system.vert?raw";
import FRAG_SHADER from "./l-system.frag?raw";
import { getProgramFromStrings } from "../webgl-helpers/Shader";
import { createBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { createVertexArray } from "../webgl-helpers/VertexArray";

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
    squareBuffer: WebGLBuffer,
    vao: WebGLVertexArrayObject,

    cubeBuffer: WebGLBuffer,
    cubeIndexBuffer: WebGLBuffer
}


function createWebGLState(gl: WebGL2RenderingContext): Result<WebGLState, string> {
    const program = getProgramFromStrings(gl, VERT_SHADER, FRAG_SHADER);
    if (!program.ok) return err("Failed to create shader program.");
    
    const buf = createBufferWithData(gl, new Float32Array([
        -1, -1, 1, -1, -1, 1, 
        1, -1, -1, 1, 1, 1
    ]).buffer, gl.STATIC_DRAW);
    if (!buf.ok) return (err("Failed to create buffer."));


    const cubeBuffer = createBufferWithData(gl, new Float32Array([
        0, 0, 0, -1, 0, 0,
        0, 1, 0, -1, 0, 0,
        0, 1, 1, -1, 0, 0,
        0, 0, 1, -1, 0, 0,
        
        1, 0, 0, 1, 0, 0,
        1, 1, 0, 1, 0, 0,
        1, 1, 1, 1, 0, 0,
        1, 0, 1, 1, 0, 0,
        
        0, 0, 0, 0, -1, 0,
        1, 0, 0, 0, -1, 0,
        1, 0, 1, 0, -1, 0,
        0, 0, 1, 0, -1, 0,
        
        0, 1, 0, 0, 1, 0,
        1, 1, 0, 0, 1, 0,
        1, 1, 1, 0, 1, 0,
        0, 1, 1, 0, 1, 0,

        0, 0, 0, 0, 0, -1,
        1, 0, 0, 0, 0, -1,
        1, 1, 0, 0, 0, -1,
        0, 1, 0, 0, 0, -1,

        0, 0, 1, 0, 0, 1,
        1, 0, 1, 0, 0, 1,
        1, 1, 1, 0, 0, 1,
        0, 1, 1, 0, 0, 1
    ]), gl.STATIC_DRAW);
    if (!cubeBuffer.ok) return err("Failed to create cube buffer");

    const cubeIndexBuffer = createBufferWithData(gl, new Uint8Array([
        1, 0, 2, 
        2, 0, 3,

        4, 5, 6, 
        4, 6, 7,

        8, 9, 10, 
        8, 10, 11,

        14, 13, 12, 
        14, 12, 15,

        17, 16, 18, 
        16, 19, 18,

        20, 21, 22, 
        20, 22, 23
    ]), gl.STATIC_DRAW, gl.ELEMENT_ARRAY_BUFFER);
    if (!cubeIndexBuffer.ok) return err("Failed to create cube index buffer");

    const v = createVertexArray(gl, program.data, {
        in_pos: {
            size: 3,
            type: gl.FLOAT,
            stride: 24,
            offset: 0,
            buffer: cubeBuffer.data
        },
        in_normal: {
            size: 3,
            type: gl.FLOAT,
            stride: 24,
            offset: 12,
            buffer: cubeBuffer.data
        }
    }, cubeIndexBuffer.data);
    if (!v.ok) return (err("Failed to create VAO."));

    return ok({
        gl,
        program: program.data,
        squareBuffer: buf.data,
        vao: v.data,

        cubeBuffer: cubeBuffer.data,
        cubeIndexBuffer: cubeIndexBuffer.data
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