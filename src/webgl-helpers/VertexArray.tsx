/// <reference path="../../node_modules/webgl-strict-types/index.d.ts" />

import { bindBuffer } from "./Buffer";
import { err, ok, Result } from "./Common";
import { bindProgram } from "./Shader";

let vertexArrayBinding: WebGLVertexArrayObject;
export function bindVertexArray(gl: WebGL2RenderingContext, vertexArray: WebGLVertexArrayObject) {
  if (vertexArrayBinding !== vertexArray) {
    gl.bindVertexArray(vertexArray);
    vertexArrayBinding = vertexArray;
  }
}

export function createVertexArray(gl: WebGL2RenderingContext, program: WebGLProgram, attribs: {
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
}, indexBuffer?: WebGLBuffer): Result<WebGLVertexArrayObject, string> {
    const vao = gl.createVertexArray();
    if (!vao) return err("Failed to create VAO.");
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
    return ok(vao);
}