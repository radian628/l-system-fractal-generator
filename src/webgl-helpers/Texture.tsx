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

export type TextureOptions = {
  min: number,
  mag: number,
  swrap: number,
  twrap: number
}

export function createTexture(
  gl: WebGL2RenderingContext, 
  options: TextureOptions
): Result<WebGLTexture, string> {
  const tex = gl.createTexture();
  if (!tex) return err("Failed to create texture.");
  bindTexture(gl, gl.TEXTURE_2D, 0, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, options.min);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, options.mag);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, options.swrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, options.twrap);
  return ok(tex);
}

export type TextureFormatOptions = {
  width: number, 
  height: number, 
  internalformat: number,
  format: number,
  type: number
};

export function declareTextureFormat(gl: WebGL2RenderingContext, 
  tex: WebGLTexture,
  options: TextureFormatOptions
) {
  bindTexture(gl, gl.TEXTURE_2D, 0, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, 
    options.internalformat, 
    options.width, 
    options.height, 0, 
    options.format, 
    options.type, null);
}

export function createTextureWithFormat(gl: WebGL2RenderingContext,
  options: TextureOptions,
  formatOptions: TextureFormatOptions
): Result<WebGLTexture, string> {
  const tex = createTexture(gl, options);
  if (!tex.ok) return tex;
  declareTextureFormat(gl, tex.data, formatOptions);
  return tex;
}