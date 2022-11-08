export let transformFeedbackBinding: WebGLTransformFeedback | null = null;
export function bindTransformFeedback(gl: WebGL2RenderingContext, tf: WebGLTransformFeedback | null) {
  if (transformFeedbackBinding !== tf) {
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
    transformFeedbackBinding = tf;
  }
}
export function setTransformFeedbackBinding(binding: WebGLTransformFeedback) {
    transformFeedbackBinding = binding;
}