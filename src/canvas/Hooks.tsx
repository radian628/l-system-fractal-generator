import { useEffect, useRef, useState } from "react";
import { err, ok, Result } from "../webgl-helpers/Common";
import VERT_SHADER from "./test.vert?raw";
import FRAG_SHADER from "./test.frag?raw";
import { getProgramFromStrings } from "../webgl-helpers/Shader";
import { createBufferWithData } from "../webgl-helpers/Buffer";
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
            //setWindowSize([window.innerWidth, window.innerHeight]);
        });
    })

    useAnimationFrame((time) => {
        const gl = canvasRef.current?.getContext("webgl2");
        if (!gl) return setWebGLError(err("Failed to create WebGL context."));

        if (!stateRef.current) {
            const program = getProgramFromStrings(gl, VERT_SHADER, FRAG_SHADER);
            if (!program.ok) return setWebGLError(err("Failed to create shader program."));
            
            const buf = createBufferWithData(gl, new Float32Array([
                -1, -1, 1, -1, -1, 1, 
                1, -1, -1, 1, 1, 1
            ]).buffer, gl.STATIC_DRAW);
            if (!buf.ok) return setWebGLError(err("Failed to create buffer."));

            const v = createVertexArray(gl, program.data, {
                pos: {
                    size: 2,
                    type: gl.FLOAT,
                    stride: 0,
                    offset: 0
                }
            });
            if (!v.ok) return setWebGLError(err("Failed to create VAO."));

            stateRef.current = {
                program: program.data,
                gl,
                squareBuffer: buf.data,
                vao: v.data
            };
        }
        callback(time, stateRef.current);
    });
    return {
        glStatus: webGLError,
        windowSize
    };
}