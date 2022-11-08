#version 300 es

precision highp float;

in vec3 pos;
in vec3 normal;

out vec4 fragColor;

void main() {
    fragColor = vec4(
        vec3(
            max(dot(normal, normalize(vec3(1, 2, 3))), 0.0)
        ), 
        1.0
    );
}