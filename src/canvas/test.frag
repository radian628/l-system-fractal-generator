#version 300 es

precision highp float;

in vec2 texcoord;
out vec4 fragColor;

void main() {
    fragColor = vec4(texcoord, 0.0, 1.0);
}