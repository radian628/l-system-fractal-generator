import { Result, resultify } from "./Common";

export const bufferBindings = new Map<number, WebGLBuffer | null>();
export function bindBuffer(gl: WebGL2RenderingContext, target: number, buffer: WebGLBuffer | null, force?: boolean) {
  if (bufferBindings.get(target) !== buffer || force) {
    gl.bindBuffer(target, buffer);
    bufferBindings.set(target, buffer);
  }
}

export const bufferBaseBindings = new Map<number, Map<number, WebGLBuffer | null>>();
export function bindBufferBase(gl: WebGL2RenderingContext, target: number, index: number, buffer: WebGLBuffer | null, force?: boolean) {
  const targetBindings = bufferBaseBindings.get(target);
  if (targetBindings?.get(target) !== buffer || force) {
    gl.bindBufferBase(target, index, buffer);
    if (targetBindings) {
      targetBindings.set(index, buffer);
    } else {
      const newTargetBindings = new Map<number, WebGLBuffer | null>();
      newTargetBindings.set(index, buffer);
      bufferBaseBindings.set(target, newTargetBindings);
    }
  }
}

export function createBuffer(gl: WebGL2RenderingContext): Result<WebGLBuffer, string> {
  return resultify(gl.createBuffer(), "Failed to create buffer");
}

export function bufferData(gl: WebGL2RenderingContext, buffer: WebGLBuffer, target: number, data: BufferSource | number, usage: number) {
  //console.log(target);
  bindBuffer(gl, target, buffer);
  if (typeof data == "number") {
    gl.bufferData(target, data, usage);
    return;
  }
  gl.bufferData(target, data, usage);
}

export function createBufferWithData(gl: WebGL2RenderingContext, data: BufferSource, usage: number, target?: number): Result<WebGLBuffer, string> {
  const buf = createBuffer(gl);
  if (!buf.ok) return buf;
  bufferData(gl, buf.data, target ? target : gl.ARRAY_BUFFER, data, usage); 
  return buf;
}