import { createRef, useEffect, useRef } from "react";
import { getProgramFromStrings, bindProgram, setUniforms, Matrix4 } from "../webgl-helpers/Shader";
import { bindBuffer, createBufferWithData } from "../webgl-helpers/Buffer";
import { bindVertexArray, createVertexArray } from "../webgl-helpers/VertexArray";
import { useAnimationFrame, useWebGLState } from "./Hooks";
import { mat4, vec3 } from "gl-matrix";
import { useInput } from "./Input";



export function MainCanvas() {
    const canvasRef = createRef<HTMLCanvasElement>();

    const inputRef = useInput(canvasRef);

    const rotationRef = useRef({ x: 0, y: 0 });

    const positionRef = useRef(vec3.fromValues(-3.5, -3.5, -3.5))

    const glState = useWebGLState(canvasRef, (time, gls) => {
        const currentRotation = 
        mat4.mul(
            mat4.create(),
            mat4.rotateX(mat4.create(), mat4.create(), rotationRef.current.y * 0.01),
            mat4.rotateY(mat4.create(), mat4.create(), rotationRef.current.x * 0.01),
        );

        const translation = vec3.fromValues(0, 0, 0);
        const k = inputRef.current.keysDown;
        if (k.W) vec3.add(translation, translation, vec3.fromValues(0, 0, 1));
        if (k.A) vec3.add(translation, translation, vec3.fromValues(1, 0, 0));
        if (k.S) vec3.add(translation, translation, vec3.fromValues(0, 0, -1));
        if (k.D) vec3.add(translation, translation, vec3.fromValues(-1, 0, 0));
        if (k.SHIFT) vec3.add(translation, translation, vec3.fromValues(0, 1, 0));
        if (k[" "]) vec3.add(translation, translation, vec3.fromValues(0, -1, 0));

        vec3.transformMat4(translation, translation, mat4.transpose(mat4.create(), currentRotation));
        vec3.scale(translation, translation, 0.1);

        vec3.add(positionRef.current, positionRef.current, translation);
        
        vec3.transformMat4(translation, translation, currentRotation);
        rotationRef.current.x += inputRef.current.mouseDeltas.x;
        rotationRef.current.y += inputRef.current.mouseDeltas.y;
        inputRef.current.mouseDeltas.x = 0;
        inputRef.current.mouseDeltas.y = 0;

        const gl = gls.gl;
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.viewport(0, 0, window.innerWidth, window.innerHeight);
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        bindVertexArray(gl, gls.vao);
        setUniforms(gl, gls.program, {
            vp: 
                Array.from(mat4.mul(    
                    mat4.create(),
                    mat4.mul(
                        mat4.create(),
                        mat4.perspective(mat4.create(), 1.5, window.innerWidth / window.innerHeight, 0.1, 1000),
                        currentRotation
                    ),
                    mat4.translate(mat4.create(), mat4.create(), positionRef.current)
                ).map(e => e)) as Matrix4

        });
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 36 * gls.lSystemInstanceCount, 1);
    });

    if (!glState.glStatus.ok) {
        //console.log(glState.glStatus.data);
        return <p>{glState.glStatus.data}</p>;
    }

    return <canvas
        id="main-canvas"
        ref={canvasRef}
        width={glState.windowSize[0]}
        height={glState.windowSize[1]}
    ></canvas>
}