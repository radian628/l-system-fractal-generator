export function deindex<T extends ArrayBufferView>(
    vertexBuffer: T, 
    indexBuffer: Uint8Array | Uint16Array | Uint32Array, 
    stride: number
): ArrayBuffer {
    const output = new DataView(new ArrayBuffer(stride * indexBuffer.length));
    const uint8VBO = new Uint8Array(vertexBuffer.buffer);
    let offset = 0;
    for (const index of indexBuffer) {
        for (let i = 0; i < stride; i++) {
            output.setUint8(
                offset,
                uint8VBO[stride * index + i]
            );
            offset++;
        }
    }
    return output.buffer;
}