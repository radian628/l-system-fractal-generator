import { err, ok, Result } from "./Common";
import { bindTransformFeedback } from "./TransformFeedback";

export let programBinding: WebGLProgram;
export function bindProgram(gl: WebGL2RenderingContext, program: WebGLProgram) {
  if (programBinding !== program) {
    gl.useProgram(program);
    programBinding = program;
  }
}
export function setProgramBinding(binding: WebGLProgram) {
  programBinding = binding;
}

export let shaderCache = new Map<string, WebGLShader>();

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

type TransformFeedbackVaryingsOptions = {
  varyings: string[],
  bufferMode: number,
};

export function getProgram(
  gl: WebGL2RenderingContext, 
  vshader: WebGLShader, 
  fshader: WebGLShader,
  transformFeedbackVaryings?: TransformFeedbackVaryingsOptions
): Result<WebGLProgram, string> {
  const program = gl.createProgram();
  if (!program) return err("Failed to create program.");
  gl.attachShader(program, vshader);
  gl.attachShader(program, fshader);
  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(
      program, 
      transformFeedbackVaryings.varyings,
      transformFeedbackVaryings.bufferMode
    );
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return err("Program linker error: \n" + gl.getProgramInfoLog(program));
  }
  return ok(program);
}

export function getProgramFromStrings(
  gl: WebGL2RenderingContext, 
  vsource: string, 
  fsource: string,
  transformFeedbackVaryings?: TransformFeedbackVaryingsOptions
): Result<WebGLProgram, string> {
  const vshader = getShader(gl, gl.VERTEX_SHADER, vsource);
  const fshader = getShader(gl, gl.FRAGMENT_SHADER, fsource);
  if (!vshader.ok) return vshader;
  if (!fshader.ok) return fshader;
  return getProgram(gl, vshader.data, fshader.data, transformFeedbackVaryings);
}

type ComponentCount = "1" | "2" | "3" | "4";
type ComponentType = "f" | "i" | "ui";

type Matrix3 = [
  number, number, number,
  number, number, number,
  number, number, number,
]

export type Matrix4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

type UniformData = 
  [number, `${ComponentType}`]
  | [[number, number], `${ComponentType}`]
  | [[number, number, number], `${ComponentType}`]
  | [[number, number, number, number], `${ComponentType}`]
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Matrix3
  | Matrix4;

export function setUniforms(gl: WebGL2RenderingContext, prog: WebGLProgram, uniforms: {
  [name: string]: UniformData
}) {
  function setUniform(loc: WebGLUniformLocation, type: ComponentType, data: number | [number, number] | [number, number, number] | [number, number, number, number]) {
    const length = Array.isArray(data) ? data.length : 1;
    const fnName: `uniform${ComponentCount}${ComponentType}` = `uniform${length}${type}`;
    if (length == 1) {
      gl[fnName as `uniform1${ComponentType}`](loc, data as number);
    } else {
      //@ts-ignore
      gl[fnName](loc, ...(data as [number, number] | [number, number, number] | [number, number, number, number]));
    }
  }

  for (const [uName, uValue] of Object.entries(uniforms)) {
    const uniformLocation = gl.getUniformLocation(prog, uName);
    if (uniformLocation === null) {
      console.error(`Unknown uniform '${uName}`);
      return;
    }
    if (Array.isArray(uValue)) {
      switch (uValue.length) {
        case 2:
        case 3:
        case 4:
          if (typeof uValue[1] == "string") {
            setUniform(uniformLocation, uValue[1], uValue[0]);
          } else {
            setUniform(uniformLocation, "f", uValue as [number, number] | [number, number, number] | [number, number, number, number]);
          }
          break;
        case 9:
          gl.uniformMatrix3fv(uniformLocation, false, uValue);
          break;
        case 16:
          gl.uniformMatrix4fv(uniformLocation, false, uValue);
          break;
      }
    } else {
      setUniform(uniformLocation, "f", uValue);
    }
  }
}