import { createRef, useEffect, useRef } from "react";
import { getProgramFromStrings, bindProgram } from "../webgl-helpers/Shader";
import { bindBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { bindVertexArray, createVertexArray } from "../webgl-helpers/VertexArray";
import { useAnimationFrame, useWebGLState } from "./Hooks";




export function MainCanvas() {
    const canvasRef = createRef<HTMLCanvasElement>();

    const glState = useWebGLState(canvasRef, (time, gls) => {
        const gl = gls.gl;
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        gl.clearColor(1.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        bindProgram(gl, gls.program);
        bindVertexArray(gl, gls.vao);
        bindBuffer(gl, gl.ARRAY_BUFFER, gls.squareBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    if (!glState.glStatus.ok) {
        return <p>{glState.glStatus.data}</p>;
    }

    return <canvas
        id="main-canvas"
        ref={canvasRef}
        width={glState.windowSize[0]}
        height={glState.windowSize[1]}
    ></canvas>
}