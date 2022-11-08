
export const cubeIndices = new Uint8Array([
    1, 0, 2,
    2, 0, 3,

    4, 5, 6,
    4, 6, 7,

    8, 9, 10,
    8, 10, 11,

    14, 13, 12,
    14, 12, 15,

    17, 16, 18,
    16, 19, 18,

    20, 21, 22,
    20, 22, 23
]);

export const cubeVertices = new Float32Array([
    0, 0, 0, -1, 0, 0,
    0, 1, 0, -1, 0, 0,
    0, 1, 1, -1, 0, 0,
    0, 0, 1, -1, 0, 0,

    1, 0, 0, 1, 0, 0,
    1, 1, 0, 1, 0, 0,
    1, 1, 1, 1, 0, 0,
    1, 0, 1, 1, 0, 0,

    0, 0, 0, 0, -1, 0,
    1, 0, 0, 0, -1, 0,
    1, 0, 1, 0, -1, 0,
    0, 0, 1, 0, -1, 0,

    0, 1, 0, 0, 1, 0,
    1, 1, 0, 0, 1, 0,
    1, 1, 1, 0, 1, 0,
    0, 1, 1, 0, 1, 0,

    0, 0, 0, 0, 0, -1,
    1, 0, 0, 0, 0, -1,
    1, 1, 0, 0, 0, -1,
    0, 1, 0, 0, 0, -1,

    0, 0, 1, 0, 0, 1,
    1, 0, 1, 0, 0, 1,
    1, 1, 1, 0, 0, 1,
    0, 1, 1, 0, 0, 1
]);