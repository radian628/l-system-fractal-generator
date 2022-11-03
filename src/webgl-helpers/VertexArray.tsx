/// <reference path="../../node_modules/webgl-strict-types/index.d.ts" />

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
        isInt?: boolean
    }
}): Result<WebGLVertexArrayObject, string> {
    const vao = gl.createVertexArray();
    if (!vao) return err("Failed to create VAO.");
    bindVertexArray(gl, vao);
    bindProgram(gl, program);
    for (const [name, settings] of Object.entries(attribs)) {
        const attribLocation = gl.getAttribLocation(program, name);
        if (attribLocation == -1) return err(`No vertex attribute '${name}' exists.`);
        if (settings.isInt) {
            gl.vertexAttribIPointer(
                attribLocation,
                settings.size,
                settings.type,
                settings.stride ?? 0,
                settings.offset
            );
        } else {
            gl.vertexAttribPointer(
                attribLocation, 
                settings.size, 
                settings.type, 
                settings.normalized ?? false,
                settings.stride ?? 0,
                settings.offset
            );
        }
        gl.enableVertexAttribArray(attribLocation);
    }
    return ok(vao);
}