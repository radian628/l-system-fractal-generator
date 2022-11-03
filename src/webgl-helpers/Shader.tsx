import { err, ok, Result } from "./Common";

let programBinding: WebGLProgram;
export function bindProgram(gl: WebGL2RenderingContext, program: WebGLProgram) {
  if (programBinding !== program) {
    gl.useProgram(program);
    programBinding = program;
  }
}

let shaderCache = new Map<string, WebGLShader>();

export function getShader(gl: WebGL2RenderingContext, type: number, source: string): Result<WebGLShader, string> {
  const cachedShader = shaderCache.get(source);
  if (cachedShader) {
    return ok(cachedShader);
  } else {
    const shader = gl.createShader(type);
    if (!shader) return err("Failed to create shader.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const infoLog = gl.getShaderInfoLog(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      return err("Shader compile error: \n" + infoLog);
    }
    shaderCache.set(source, shader);
    return ok(shader);
  }
}

export function getProgram(gl: WebGL2RenderingContext, vshader: WebGLShader, fshader: WebGLShader): Result<WebGLProgram, string> {
  const program = gl.createProgram();
  if (!program) return err("Failed to create program.");
  gl.attachShader(program, vshader);
  gl.attachShader(program, fshader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return err("Program linker error: \n" + gl.getProgramInfoLog(program));
  }
  return ok(program);
}

export function getProgramFromStrings(gl: WebGL2RenderingContext, vsource: string, fsource: string): Result<WebGLProgram, string> {
  const vshader = getShader(gl, gl.VERTEX_SHADER, vsource);
  const fshader = getShader(gl, gl.FRAGMENT_SHADER, fsource);
  if (!vshader.ok) return vshader;
  if (!fshader.ok) return fshader;
  return getProgram(gl, vshader.data, fshader.data);
}