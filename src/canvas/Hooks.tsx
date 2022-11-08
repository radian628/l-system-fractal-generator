import { useEffect, useRef, useState } from "react";
import { err, ok, Result } from "../webgl-helpers/Common";
import VERT_SHADER from "./l-system.vert?raw";
import FRAG_SHADER from "./l-system.frag?raw";
import { bindProgram, getProgramFromStrings, Matrix4, setUniforms } from "../webgl-helpers/Shader";
import { bindBuffer, bindBufferBase, bufferData, createBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { bindVertexArray, createVertexArray } from "../webgl-helpers/VertexArray";
import { applyLSystem, iterateLSystem, mapLSystemApplication, optimizeAndApplyLSystem, optimizeLSystemSpec } from "../l-system/LSystemGenerator";
import { mat4, vec3 } from "gl-matrix";
import { bindTransformFeedback } from "../webgl-helpers/TransformFeedback";
import { transform } from "typescript";

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
    squareBuffer: WebGLBuffer,
    vao: WebGLVertexArrayObject,
    lSystemMatrixBuffer: WebGLBuffer,
    lSystemInstanceCount: number,

    transformFeedbackTestBuffer: WebGLBuffer,

    cubeBuffer: WebGLBuffer,
    cubeIndexBuffer: WebGLBuffer
}


function createWebGLState(gl: WebGL2RenderingContext): Result<WebGLState, string> {
    const tf = gl.createTransformFeedback();
    if (!tf) return err("Failed to create transform feedback.");
    const program = getProgramFromStrings(gl, VERT_SHADER, FRAG_SHADER, {
        varyings: ["pos", "normal"],
        bufferMode: gl.INTERLEAVED_ATTRIBS,
        tf
    });
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


    let lSystemInstanceBuffer: Result<WebGLBuffer, string> = err("Failed to create L system instance buffer.");
    let lSystemInstanceCount = 0;
    //const optSpec = optimizeLSystemSpec();
    const sf = 0.75;
    const scalevec = vec3.fromValues(sf, sf, sf);
    const scalevec2 = vec3.fromValues(1/sf, 1/sf, 1/sf);
    const angle1 = 2.3999632297286533;
    const angle2 = Math.PI / 6;
    const app = optimizeAndApplyLSystem(
        {
            axiom: ["0"],
            substitutions: new Map([
                ["1", "1".split("")],
                ["0", "1[0]0B".split("")]
            ]),
            alphabet: "01[]B".split("")
        },
        {
        executions: new Map([
            ["0", m => {
                return m;//mat4.translate(m, m, vec3.fromValues(0, 0, 2));
            }],
            ["1", (m, d) => {
                mat4.translate(m, m, vec3.fromValues(0, 1, 0));
                //d(m, vec3.fromValues(0, 1, 0));
                mat4.rotateY(m, m, angle1);
                mat4.scale(m, m, scalevec);
                return m;
            }],
            ["[", m => {
                mat4.rotateZ(m, m, angle2);
                return m;
            }],
            ["]", m => {
                //mat4.scale(m, m, vec3.fromValues(1/0.8, 1/0.8, 1/0.8));
                //mat4.translate(m, m, vec3.fromValues(0, 0, -1));
                mat4.rotateZ(m, m, -angle2 * 1.4);
                return m;
            }],
            ["B", (m, d) => {
                mat4.rotateZ(m, m, angle2 * 0.4);
                mat4.scale(m, m, scalevec2);
                mat4.rotateY(m, m, -angle1);
                d(m, vec3.fromValues(0, -1, 0));
                return m
            }]
        ])
    }, 10);

    if (!app.ok) return err("L-system failed.");

    console.log(app);
    const matrices = app.data.alphabetResults.get(0);
    lSystemInstanceCount = matrices?.transformations.length ?? 0;
    lSystemInstanceBuffer = createBufferWithData(gl, new Float32Array(
        matrices?.transformations.map(m => Array.from(m)).flat() ?? []
    ), gl.STATIC_DRAW);

    if (!lSystemInstanceBuffer.ok) return lSystemInstanceBuffer;


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
        },
        transform: {
            size: 4,
            type: gl.FLOAT,
            stride: 64,
            offset: 0,
            buffer: lSystemInstanceBuffer.data,
            divisor: 1,
            slots: 4
        }
    }, cubeIndexBuffer.data);
    if (!v.ok) return (err("Failed to create VAO."));






    const v2 = createVertexArray(gl, program.data, {
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
        },
        transform: {
            size: 4,
            type: gl.FLOAT,
            stride: 64,
            offset: 0,
            buffer: lSystemInstanceBuffer.data,
            divisor: 1,
            slots: 4
        }
    }, cubeIndexBuffer.data);
    if (!v2.ok) return (err("Failed to create VAO."));

    bindVertexArray(gl, null);

    let transformFeedbackTestBuffer = createBuffer(gl);
    if (!transformFeedbackTestBuffer.ok) return err("Failed to create transform feedback test buffer.");
    bufferData(
        gl, 
        transformFeedbackTestBuffer.data, 
        gl.TRANSFORM_FEEDBACK_BUFFER, 
        lSystemInstanceCount * 36 * 6,
        gl.DYNAMIC_DRAW
    );
    //bindBuffer(gl, gl.ARRAY_BUFFER, null);
    console.log("matrices", matrices);

    gl.enable(gl.RASTERIZER_DISCARD);

    bindTransformFeedback(gl, tf);

    bindBufferBase(gl, gl.TRANSFORM_FEEDBACK_BUFFER, 0, 
        transformFeedbackTestBuffer.data, true);
    console.log("transform feedback buffer size", gl.getBufferParameter(
        gl.TRANSFORM_FEEDBACK_BUFFER,
        gl.BUFFER_SIZE
    ));
    bindProgram(gl, program.data);
    bindVertexArray(gl, v2.data);
    setUniforms(gl, program.data, {
        vp: [...mat4.create()] as Matrix4
    });
    
    console.log("array buffer size", gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE));
    gl.beginTransformFeedback(gl.TRIANGLES);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 24, lSystemInstanceCount);
    gl.endTransformFeedback();
    bindTransformFeedback(gl, null);

    gl.disable(gl.RASTERIZER_DISCARD);


    bindBufferBase(gl, gl.TRANSFORM_FEEDBACK_BUFFER, 0, 
        null);
    bindBuffer(gl, gl.ARRAY_BUFFER, transformFeedbackTestBuffer.data);

    const testTFBuffer = new Float32Array(12 * 36 * lSystemInstanceCount);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, testTFBuffer, 0, 1 * 36 * lSystemInstanceCount);
    console.log(testTFBuffer);

    return ok({
        gl,
        program: program.data,
        squareBuffer: buf.data,
        vao: v.data,
        lSystemMatrixBuffer: lSystemInstanceBuffer.data,
        lSystemInstanceCount,

        transformFeedbackTestBuffer: transformFeedbackTestBuffer.data,

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