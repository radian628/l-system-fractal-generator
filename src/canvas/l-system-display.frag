#version 300 es

precision highp float;

in vec3 pos;
in vec3 normal;

out vec4 fragColor;

uniform vec3 camera_position;

uniform highp sampler2DShadow shadow_map;

uniform mat4 light_vp;

void main() {
    vec3 light = normalize(vec3(1, 2, 3));
    vec3 viewer = normalize(-camera_position - pos);


    vec4 light_pos = (light_vp * vec4(pos, 1.0)) * 0.5 + 0.5;
    float is_shaded = 0.0;
    int samples = 0;
    for (int i = -1; i < 2; i++) {
        for (int j = -1; j < 2; j++) {    
            samples++;
            is_shaded += texture(shadow_map, 
                vec3(
                    light_pos.xy + vec2(i, j) / vec2(1024.0),
                    light_pos.z - 0.005
                )
            );
        }
    }
    is_shaded /= float(samples);

    fragColor = vec4(
        (vec3(
            max(dot(normal, light), 0.0)
        )
        
        +

        vec3(
            pow(max(0.0, dot(reflect(light, normal), -viewer)), 16.0)
        )
        
        +

        vec3(
            0.1
        ))

        * mix(0.1, 1.0, is_shaded)

        , 
        1.0
    );
}