#version 300 es

precision highp float;

in vec3 in_pos;
in vec3 in_normal;

in mat4 transform;

out vec3 pos;
out vec3 normal;

uniform mat4 vp;

void main() {
    vec4 partly_transformed_position = transform * vec4(in_pos, 1.0);
    vec4 transformed_position = (vp * partly_transformed_position);
    vec3 transformed_normal = normalize((transform * vec4(in_normal, 0.0)).xyz);
    pos = partly_transformed_position.xyz;
    normal = transformed_normal;
    gl_Position = transformed_position;
}