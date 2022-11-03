#version 300 es

precision highp float;

in vec2 pos;
out vec2 texcoord;

void main() {
    texcoord = pos * 0.5 + 0.5;
    gl_Position = vec4(pos, 0.5, 1.0);
}