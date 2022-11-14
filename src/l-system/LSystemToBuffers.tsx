import { mat4 } from "gl-matrix";
import { bindBufferBase, createBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { err, ok, Result } from "../webgl-helpers/Common";
import { bindProgram, Matrix4, setUniforms } from "../webgl-helpers/Shader";
import { bindTransformFeedback } from "../webgl-helpers/TransformFeedback";
import { addDataToVertexArray, bindVertexArray, createVertexArray } from "../webgl-helpers/VertexArray";
import { LSystemApplication, LSystemSpecification, optimizeAndApplyLSystem } from "./LSystemGenerator";

export type LSystemBufferData = {
    map: Map<number, {
        // 4x4 matrices corresponding to submesh transformations
        // NOT the original transformations used to create the submesh!
        instances: WebGLBuffer,
        instanceCount: number,

        // actual mesh corresponding to given letter of the L-system alphabet
        submesh: WebGLBuffer,
        submeshSize: number,

        vao: WebGLVertexArrayObject
    }>;
}

export function LSystemToBuffers(
    gl: WebGL2RenderingContext,
    glState: {
        meshGenProgram: WebGLProgram,
        meshDisplayProgram: WebGLProgram,
        cubeBuffer: WebGLBuffer,
        tf: WebGLTransformFeedback
    },
    spec: LSystemSpecification<string>,
    code: LSystemApplication<string>,
    mainIterations: number,
    subtreeIterations: number
): Result<LSystemBufferData, string> {
    const app = optimizeAndApplyLSystem(spec, code, mainIterations, subtreeIterations);
    if (!app.ok) return app;

    const bufferData: LSystemBufferData = {
        map: new Map()
    };

    const vao = gl.createVertexArray();
    if (!vao) return err("Failed to create VAO.");

    for (let [token, result] of app.data.alphabetResults) {
        const matrices = result.transformations;
        
        const transformationBuffer = createBufferWithData(gl, new Float32Array(
            matrices.map(m => Array.from(m)).flat() ?? []
        ), gl.STREAM_DRAW, gl.ARRAY_BUFFER);
        if (!transformationBuffer.ok) return transformationBuffer;

        addDataToVertexArray(
            gl,
            vao,
            glState.meshGenProgram,
            {
                in_pos: {
                    size: 3,
                    type: gl.FLOAT,
                    stride: 24,
                    offset: 0,
                    buffer: glState.cubeBuffer
                },
                in_normal: {
                    size: 3,
                    type: gl.FLOAT,
                    stride: 24,
                    offset: 12,
                    buffer: glState.cubeBuffer
                },
                transform: {
                    size: 4,
                    type: gl.FLOAT,
                    stride: 64,
                    offset: 0,
                    buffer: transformationBuffer.data,
                    divisor: 1,
                    slots: 4
                }
            }
        );

        const outputVertexBuffer = createBufferWithData(
            gl, 
            // instances * vertices/instance * floats/vertex * bytes/float
            matrices.length * 36 * 6 * 4,
            gl.DYNAMIC_DRAW,
            gl.TRANSFORM_FEEDBACK_BUFFER
        );
        if (!outputVertexBuffer.ok) return err("Failed to create transform feedback test buffer.");

        gl.enable(gl.RASTERIZER_DISCARD);

        bindTransformFeedback(gl, glState.tf);

        bindBufferBase(
            gl,
            gl.TRANSFORM_FEEDBACK_BUFFER,
            0,
            outputVertexBuffer.data,
            true
        );
        bindProgram(gl, glState.meshGenProgram);
        bindVertexArray(gl, vao);
        setUniforms(gl, glState.meshGenProgram, {
            vp: [...mat4.create()] as Matrix4
        });

        gl.beginTransformFeedback(gl.TRIANGLES);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, matrices.length);
        gl.endTransformFeedback();
        bindTransformFeedback(gl, null);

        gl.disable(gl.RASTERIZER_DISCARD);

        gl.deleteBuffer(transformationBuffer.data);

        bindBufferBase(gl, gl.TRANSFORM_FEEDBACK_BUFFER, 0, 
            null);

        const instances = createBufferWithData(gl,
            new Float32Array(
                app.data.alphabetTransformationLists.get(token)
                    ?.map(m => Array.from(m)).flat() ?? []
            ), gl.STATIC_DRAW);
        if (!instances.ok) return instances;

        const outputVao = createVertexArray(
            gl,
            glState.meshDisplayProgram,
            {
                in_pos: {
                    size: 3,
                    type: gl.FLOAT,
                    stride: 24,
                    offset: 0,
                    buffer: outputVertexBuffer.data
                },
                in_normal: {
                    size: 3,
                    type: gl.FLOAT,
                    stride: 24,
                    offset: 12,
                    buffer: outputVertexBuffer.data
                },
                transform: {
                    size: 4,
                    type: gl.FLOAT,
                    stride: 64,
                    offset: 0,
                    buffer: instances.data,
                    divisor: 1,
                    slots: 4
                }
            }
        );
        if (!outputVao.ok) return err("Failed to create output VAO.");

        bufferData.map.set(token, {
            instanceCount: app.data.alphabetTransformationLists.get(token)?.length ?? 0,
            instances: instances.data,

            submesh: outputVertexBuffer.data,
            submeshSize: matrices.length * 36,

            vao: outputVao.data
        });
    }

    return ok(bufferData);
}



export function drawLSystemToBuffers(gl: WebGL2RenderingContext, displayProgram: WebGLProgram, vp: Matrix4, lsbd: LSystemBufferData) {
    for (const data of lsbd.map.values()) {
        bindVertexArray(gl, data.vao);
        bindProgram(gl, displayProgram);
        setUniforms(gl, displayProgram, {
            vp
        });
        gl.drawArraysInstanced(gl.TRIANGLES, 0, data.submeshSize, data.instanceCount);
    }
}