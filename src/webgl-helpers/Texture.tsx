import { err, ok, Result } from "./Common";

const textureBindings = new Map<number, Map<number, WebGLTexture>>();
export function bindTexture(gl: WebGL2RenderingContext, target: number, unit: number, texture: WebGLTexture) {
  const targetBindings = textureBindings.get(target);
  if (targetBindings?.get(unit) !== texture) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, texture);
    if (targetBindings) {
      targetBindings.set(unit, texture);
    } else {
      const newTargetBindings = new Map<number, WebGLTexture>();
      newTargetBindings.set(unit, texture);
      textureBindings.set(target, newTargetBindings);
    }
  }
}

export function createTexture(gl: WebGL2RenderingContext, options: {
  min: number,
  mag: number,
  swrap: number,
  twrap: number
}): Result<WebGLTexture, string> {
  const tex = gl.createTexture();
  if (!tex) return err("Failed to create texture.");
  bindTexture(gl, gl.TEXTURE_2D, 0, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.mag);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.swrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.twrap);
  return ok(tex);
}