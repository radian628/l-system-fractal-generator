import { useEffect, useRef, useState } from "react";
import { err, ok, Result } from "../webgl-helpers/Common";
import GEN_VERT_SHADER from "./l-system-generation.vert?raw";
import GEN_FRAG_SHADER from "./l-system-generation.frag?raw";
import GBUFFER_VERT_SHADER from "./l-system-gbuffer.vert?raw";
import GBUFFER_FRAG_SHADER from "./l-system-gbuffer.frag?raw";
import DISP_SHADOW_FRAG_SHADER from "./l-system-shadow-display.frag?raw";
import { bindProgram, getProgramFromStrings, Matrix4, setUniforms } from "../webgl-helpers/Shader";
import { bindBuffer, bindBufferBase, bufferData, createBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { cubeIndices, cubeVertices } from "./VertexData";
import { deindex } from "../webgl-helpers/WebGLUtils";
import { LSystemBufferData, LSystemToBuffers } from "../l-system/LSystemToBuffers";
import { compile, LSystemDSLCompilerOutput } from "../code-editor/Compiler";
import { getIteratedLSystemDrawCount, getIteratedLSystemLength } from "../l-system/LSystemGenerator";
import { createFramebufferWithAttachments, FramebufferWithAttachments } from "../webgl-helpers/Framebuffer";

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
    lSystemBufferData: LSystemBufferData,
    shadowFramebuffer: FramebufferWithAttachments,
    programs: Programs
}

function createShadowFramebuffer(gl: WebGL2RenderingContext): Result<FramebufferWithAttachments, string> {
    return createFramebufferWithAttachments(gl, [], {
        texture: {
            min: gl.LINEAR,
            mag: gl.LINEAR,
            swrap: gl.REPEAT,
            twrap: gl.REPEAT,
            compareMode: gl.COMPARE_REF_TO_TEXTURE,
            compareFunc: gl.LEQUAL
        },
        format: {
            width: 1024,
            height: 1024,
            internalformat: gl.DEPTH_COMPONENT32F,
            format: gl.DEPTH_COMPONENT,
            type: gl.FLOAT
        }
    });
}

function createGBufferFramebuffer(gl: WebGL2RenderingContext, width: number, height: number): Result<FramebufferWithAttachments, string> {
  const dimensions = { width, height };
  const texFilters = {
    min: gl.LINEAR,
    mag: gl.LINEAR,
    swrap: gl.REPEAT,
    twrap: gl.REPEAT,
  }
  return createFramebufferWithAttachments(gl, [
    { // position buffer
      texture: texFilters,
      format: {
        ...dimensions,
        internalformat: gl.RGB32F,
        format: gl.RGB,
        type: gl.FLOAT
      }
    },
    { // normal buffer
      texture: texFilters,
      format: {
        ...dimensions,
        internalformat: gl.RGB8,
        format: gl.RGB,
        type: gl.UNSIGNED_BYTE
      }
    },
    { // albedo buffer (specular in alpha channel)
      texture: texFilters,
      format: {
        ...dimensions,
        internalformat: gl.RGBA8,
        format: gl.RGBA,
        type: gl.UNSIGNED_BYTE
      }
    }
  ], { // depth buffer (for depth testing)
    texture: {
      ...texFilters,
      compareMode: gl.COMPARE_REF_TO_TEXTURE,
      compareFunc: gl.LEQUAL
    },
    format: {
      ...dimensions,
      internalformat: gl.DEPTH_COMPONENT32F,
      format: gl.DEPTH_COMPONENT,
      type: gl.FLOAT
    }
  });
}

type Programs = {
    gen: WebGLProgram,
    gbuffer: WebGLProgram,
    display: WebGLProgram,
    shadow: WebGLProgram
}

function createWebGLState(
    gl: WebGL2RenderingContext,     
    options: {
        lSystem: LSystemDSLCompilerOutput,
        segments: number
    },
    programs: Programs
): Result<WebGLState, string> {
    const tf = gl.createTransformFeedback();
    if (!tf) return err("Failed to create transform feedback.");

    const deindexedCubeVertices = new Float32Array(deindex(cubeVertices, cubeIndices, 4 * 6));

    const deindexedCubeBuffer = createBufferWithData(gl, deindexedCubeVertices, gl.STATIC_DRAW);
    if (!deindexedCubeBuffer.ok) return err("Failed to create deindexed cube buffer");

    const compiledLSys = options.lSystem;

    let iterations = 1;
    while (getIteratedLSystemDrawCount(compiledLSys.spec, compiledLSys.app, iterations) < options.segments && iterations < 30) {
        iterations++;
    }

    const lsbd = LSystemToBuffers(
        gl,
        {
            meshGenProgram: programs.gen,
            meshDisplayProgram: programs.gbuffer,
            cubeBuffer: deindexedCubeBuffer.data,
            tf
        },
        compiledLSys.spec,
        compiledLSys.app,
        Math.floor(iterations / 2),
        iterations - Math.floor(iterations / 2)
    );
    if (!lsbd.ok) return err("Failed to convert L system to buffers.");

    const shadowFramebuffer = createShadowFramebuffer(gl);
    if (!shadowFramebuffer.ok) return shadowFramebuffer;

    return ok({
        gl,
        programs,

        lSystemBufferData: lsbd.data,

        shadowFramebuffer: shadowFramebuffer.data
    });
}



export function useWebGLState(
    canvasRef: React.RefObject<HTMLCanvasElement | undefined>, 
    options: {
        lSystem: LSystemDSLCompilerOutput,
        segments: number
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
    }, [options.lSystem, options.segments]);

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
    const gbufferProgramRef = useRef<WebGLProgram>();
    const dispShadowProgramRef = useRef<WebGLProgram>();

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
        
        if (!gbufferProgramRef.current) {
            const dispProgram = getProgramFromStrings(gl, GBUFFER_VERT_SHADER, GBUFFER_FRAG_SHADER);
            if (!dispProgram.ok) return;
            gbufferProgramRef.current = dispProgram.data;
            return;
        }
        
        if (!dispShadowProgramRef.current) {
            const dispShadowProgram = getProgramFromStrings(gl, GBUFFER_VERT_SHADER, DISP_SHADOW_FRAG_SHADER);
            if (!dispShadowProgram.ok) return;
            dispShadowProgramRef.current = dispShadowProgram.data;
            return;
        }

        if (!stateRef.current) {
            const state = createWebGLState(gl, optionsUpToDate.current, {
                gen: genProgramRef.current,
                gbuffer: gbufferProgramRef.current,
                shadow: dispShadowProgramRef.current
            });

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