import { Result, resultify } from "./Common";

const bufferBindings = new Map<number, WebGLBuffer>();
export function bindBuffer(gl: WebGL2RenderingContext, target: number, buffer: WebGLBuffer, force?: boolean) {
  if (bufferBindings.get(target) !== buffer || force) {
    gl.bindBuffer(target, buffer);
    bufferBindings.set(target, buffer);
  }
}

export function createBuffer(gl: WebGL2RenderingContext): Result<WebGLBuffer, string> {
  return resultify(gl.createBuffer(), "Failed to create buffer");
}

export function bufferData(gl: WebGL2RenderingContext, buffer: WebGLBuffer, target: number, data: BufferSource, usage: number) {
  //console.log(target);
  bindBuffer(gl, target, buffer);
  gl.bufferData(target, data, usage);
}

export function createBufferWithData(gl: WebGL2RenderingContext, data: BufferSource, usage: number, target?: number): Result<WebGLBuffer, string> {
  const buf = createBuffer(gl);
  if (!buf.ok) return buf;
  bufferData(gl, buf.data, target ? target : gl.ARRAY_BUFFER, data, usage); 
  return buf;
}