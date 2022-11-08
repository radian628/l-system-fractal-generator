import { bufferBindings } from "./Buffer";
import { framebufferBindings } from "./Framebuffer";
import { programBinding, setProgramBinding, shaderCache } from "./Shader";
import { textureBindings } from "./Texture";
import { setVertexArrayBinding, vertexArrayBinding } from "./VertexArray";

export type Result<Ok, Err> = {
  ok: true,
  data: Ok
} | {
  ok: false,
  data: Err
};

export function ok<Ok, Err>(data: Ok): Result<Ok, Err> {
  return { ok: true, data }
}
export function err<Ok, Err>(data: Err): Result<Ok, Err> {
  return { ok: false, data }
}
export function resultify<Ok, Err>(data: Ok | undefined | null, err: Err): Result<Ok, Err> {
  if (data !== undefined && data !== null) {
    return { ok: true, data };
  } else {
    return { ok: false, data: err };
  }
}
export function okmap<Ok, Err, Ok2>(result: Result<Ok, Err>, callback: (ok: Ok) => Ok2): Result<Ok2, Err> {
  return result.ok ? { ok: true, data: callback(result.data) } : result;
}

export function clearBindingCache() {
  bufferBindings.clear();
  framebufferBindings.clear();
  setProgramBinding(undefined as any as WebGLProgram);
  textureBindings.clear();
  setVertexArrayBinding(undefined as any as WebGLVertexArrayObject);
  shaderCache.clear();
}