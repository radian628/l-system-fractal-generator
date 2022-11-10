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
    squareBuffer: WebGLBuffer,
    vao: WebGLVertexArrayObject,
    lSystemMatrixBuffer: WebGLBuffer,
    lSystemInstanceCount: number,

    transformFeedbackTestBuffer: WebGLBuffer,

    cubeBuffer: WebGLBuffer,
    cubeIndexBuffer: WebGLBuffer,

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
    
    const buf = createBufferWithData(gl, new Float32Array([
        -1, -1, 1, -1, -1, 1, 
        1, -1, -1, 1, 1, 1
    ]).buffer, gl.STATIC_DRAW);
    if (!buf.ok) return (err("Failed to create buffer."));

    const deindexedCubeVertices = new Float32Array(deindex(cubeVertices, cubeIndices, 4 * 6));

    const cubeBuffer = createBufferWithData(gl, cubeVertices, gl.STATIC_DRAW);
    if (!cubeBuffer.ok) return err("Failed to create cube buffer");

    const cubeIndexBuffer = createBufferWithData(gl, cubeIndices, gl.STATIC_DRAW, gl.ELEMENT_ARRAY_BUFFER);
    if (!cubeIndexBuffer.ok) return err("Failed to create cube index buffer");

    const deindexedCubeBuffer = createBufferWithData(gl, deindexedCubeVertices, gl.STATIC_DRAW);
    if (!deindexedCubeBuffer.ok) return err("Failed to create deindexed cube buffer");

    let lSystemInstanceBuffer: Result<WebGLBuffer, string> = err("Failed to create L system instance buffer.");
    let lSystemInstanceCount = 0;
    //const optSpec = optimizeLSystemSpec();
    const sf = 0.75;
    const scalevec = vec3.fromValues(sf, sf, sf);
    const scalevec2 = vec3.fromValues(1/sf, 1/sf, 1/sf);
    const angle1 = 2.3999632297286533;
    const angle2 = Math.PI / 6;
    const lSystemSpec = {
        axiom: ["0"],
        substitutions: new Map([
            ["1", "1".split("")],
            ["0", "1[0]0B".split("")]
        ]),
        alphabet: "01[]B".split("")
    };
    const lSystemApp: LSystemApplication<string> = {
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
    };

    const compiledLSys = compile(sampleCode);
    if (!compiledLSys.ok) return err(JSON.stringify(compiledLSys.data));

    const app = optimizeAndApplyLSystem(
        compiledLSys.data.spec, compiledLSys.data.app
    , 5, 5);

    if (!app.ok) return err("L-system failed.");

    console.log(app);
    const matrices = app.data.alphabetResults.get(0);
    lSystemInstanceCount = matrices?.transformations.length ?? 0;
    lSystemInstanceBuffer = createBufferWithData(gl, new Float32Array(
        matrices?.transformations.map(m => Array.from(m)).flat() ?? []
    ), gl.STATIC_DRAW);

    if (!lSystemInstanceBuffer.ok) return lSystemInstanceBuffer;







    const v2 = createVertexArray(gl, genProgram.data, {
        in_pos: {
            size: 3,
            type: gl.FLOAT,
            stride: 24,
            offset: 0,
            buffer: deindexedCubeBuffer.data
        },
        in_normal: {
            size: 3,
            type: gl.FLOAT,
            stride: 24,
            offset: 12,
            buffer: deindexedCubeBuffer.data
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
        lSystemInstanceCount * 36 * (6) * 4,
        gl.DYNAMIC_DRAW
    );
    console.log(lSystemInstanceBuffer, lSystemInstanceCount);
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
    bindProgram(gl, genProgram.data);
    bindVertexArray(gl, v2.data);
    setUniforms(gl, genProgram.data, {
        vp: [...mat4.create()] as Matrix4
    });
    
    console.log("array buffer size", gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE));
    gl.beginTransformFeedback(gl.TRIANGLES);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, lSystemInstanceCount);
    gl.endTransformFeedback();
    bindTransformFeedback(gl, null);

    gl.disable(gl.RASTERIZER_DISCARD);


    bindBufferBase(gl, gl.TRANSFORM_FEEDBACK_BUFFER, 0, 
        null);
    bindBuffer(gl, gl.ARRAY_BUFFER, transformFeedbackTestBuffer.data);

    //const testTFBuffer = new Float32Array(12 * 36 * lSystemInstanceCount);
    //gl.getBufferSubData(gl.ARRAY_BUFFER, 0, testTFBuffer, 0, 6 * 24 * lSystemInstanceCount);
    //console.log(testTFBuffer);

    const identityMatrixBuffer = createBufferWithData(
        gl,
        new Float32Array(mat4.create()),
        gl.STATIC_DRAW,
        gl.ARRAY_BUFFER
    );
    if (!identityMatrixBuffer.ok) return err("Failed to create identity matrix buffer.");


    const v = createVertexArray(gl, dispProgram.data, {
        in_pos: {
            size: 3,
            type: gl.FLOAT,
            stride: 24,
            offset: 0,
            buffer: transformFeedbackTestBuffer.data
        },
        in_normal: {
            size: 3,
            type: gl.FLOAT,
            stride: 24,
            offset: 12,
            buffer: transformFeedbackTestBuffer.data
        },
        transform: {
            size: 4,
            type: gl.FLOAT,
            stride: 64,
            offset: 0,
            buffer: identityMatrixBuffer.data,
            divisor: 1,
            slots: 4
        }
    });
    if (!v.ok) return (err("Failed to create VAO."));

    const lsbd = LSystemToBuffers(
        gl,
        {
            meshGenProgram: genProgram.data,
            meshDisplayProgram: dispProgram.data,
            cubeBuffer: deindexedCubeBuffer.data,
            tf
        },
        lSystemSpec,
        lSystemApp,
        5,
        5
    );
    if (!lsbd.ok) return err("Failed to convert L system to buffers.");

    return ok({
        gl,
        program: dispProgram.data,
        squareBuffer: buf.data,
        vao: v.data,
        lSystemMatrixBuffer: lSystemInstanceBuffer.data,
        lSystemInstanceCount,

        transformFeedbackTestBuffer: transformFeedbackTestBuffer.data,

        cubeBuffer: cubeBuffer.data,
        cubeIndexBuffer: cubeIndexBuffer.data,

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