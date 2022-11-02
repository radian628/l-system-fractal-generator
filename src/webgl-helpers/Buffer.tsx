import { Result, resultify } from "./Common";

const bufferBindings = new Map<number, WebGLBuffer>();
export function bindBuffer(gl: WebGL2RenderingContext, target: number, buffer: WebGLBuffer) {
  if (bufferBindings.get(target) !== buffer) {
    gl.bindBuffer(target, buffer);
    bufferBindings.set(target, buffer);
  }
}

export function createBuffer(gl: WebGL2RenderingContext): Result<WebGLBuffer, string> {
  return resultify(gl.createBuffer(), "Failed to create buffer");
}

export function bufferData(gl: WebGL2RenderingContext, buffer: WebGLBuffer, data: ArrayBuffer, usage: number) {
  bindBuffer(gl, gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
}

export function createBufferWithData(gl: WebGL2RenderingContext, data: ArrayBuffer, usage: number): Result<WebGLBuffer, string> {
  const buf = createBuffer(gl);
  if (!buf) return buf;
  bufferData(gl, buf, data, usage); 
  return buf;
}