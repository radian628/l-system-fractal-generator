/// <reference path="../../node_modules/webgl-strict-types/index.d.ts" />

import { bindBuffer } from "./Buffer";
import { err, ok, Result } from "./Common";
import { bindProgram } from "./Shader";

export let vertexArrayBinding: WebGLVertexArrayObject | null;
export function bindVertexArray(gl: WebGL2RenderingContext, vertexArray: WebGLVertexArrayObject | null) {
  if (vertexArrayBinding !== vertexArray) {
    gl.bindVertexArray(vertexArray);
    vertexArrayBinding = vertexArray;
  }
}
export function setVertexArrayBinding(binding: WebGLVertexArrayObject) {
  vertexArrayBinding = binding;
}

export type Attribs = {
    [attribName: string]: {
        size: number,
        type: number,
        normalized?: boolean,
        stride?: number,
        offset: number,
        isInt?: boolean,
        slots?: number,
        divisor?: number,
        buffer: WebGLBuffer
    }
};

export function addDataToVertexArray(
    gl: WebGL2RenderingContext, 
    vao: WebGLVertexArrayObject,
    program: WebGLProgram, 
    attribs: Attribs, 
    indexBuffer?: WebGLBuffer
) {
    bindVertexArray(gl, vao);
    bindProgram(gl, program);
    if (indexBuffer) {
        bindBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, indexBuffer, true);
    }
    for (const [name, settings] of Object.entries(attribs)) {
        bindBuffer(gl, gl.ARRAY_BUFFER, settings.buffer);
        const attribLocation = gl.getAttribLocation(program, name);
        if (attribLocation == -1) return err(`No vertex attribute '${name}' exists.`);
        if (!settings.slots) settings.slots = 1;
        for (let i = 0; i < settings.slots; i++) {
            if (settings.isInt) {
                gl.vertexAttribIPointer(
                    attribLocation + i,
                    settings.size,
                    settings.type,
                    settings.stride ?? 0,
                    settings.offset + i * settings.size * 4
                );
            } else {
                gl.vertexAttribPointer(
                    attribLocation + i, 
                    settings.size, 
                    settings.type, 
                    settings.normalized ?? false,
                    settings.stride ?? 0,
                    settings.offset + i * settings.size * 4
                );
            }
            if (settings.divisor != undefined) {
                gl.vertexAttribDivisor(attribLocation + i, settings.divisor);
            }
            gl.enableVertexAttribArray(attribLocation + i);
        }
    }
}


export function createVertexArray(
    gl: WebGL2RenderingContext, 
    program: WebGLProgram, 
    attribs: Attribs, 
    indexBuffer?: WebGLBuffer
): Result<WebGLVertexArrayObject, string> {
    const vao = gl.createVertexArray();
    if (!vao) return err("Failed to create VAO.");
    addDataToVertexArray(gl, vao, program, attribs, indexBuffer);
    return ok(vao);
}