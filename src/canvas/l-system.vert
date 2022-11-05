#version 300 es

precision highp float;

in vec3 in_pos;
in vec3 in_normal;

const mat4 transform = mat4(
    1, 0, 0, 0, 
    0, 1, 0, 0, 
    0, 0, 1, 0, 
    0, 0, 0, 1);

out vec3 pos;
out vec3 normal;

uniform mat4 vp;

void main() {
    vec4 transformed_position = (vp * transform * vec4(in_pos, 1.0));
    vec3 transformed_normal = (transform * vec4(in_normal, 0.0)).xyz;
    pos = transformed_position.xyz;
    normal = transformed_normal;
    gl_Position = transformed_position;
    // pos = in_pos;
    // normal = in_normal;
    // gl_Position = vec4(in_pos.xy, 0.5, 1.0);
}