import { err, ok, Result } from "./Common";
import { createTextureWithFormat, TextureFormatOptions, TextureOptions } from "./Texture";

const framebufferBindings = new Map<number, WebGLFramebuffer>();
export function bindFramebuffer(gl: WebGL2RenderingContext, target: number, framebuffer: WebGLFramebuffer) {
  if (framebufferBindings.get(target) !== framebuffer) {
    gl.bindFramebuffer(target, framebuffer);
    framebufferBindings.set(target, framebuffer);
  }
}

export function createFramebufferWithAttachments(
    gl: WebGL2RenderingContext,
    attachments: {
        texture: TextureOptions,
        format: TextureFormatOptions
    }[]
): Result<{ framebuffer: WebGLFramebuffer, attachments: WebGLTexture[] }, string> {
    const fb = gl.createFramebuffer();
    if (!fb) return err("Failed to create framebuffer.");
    bindFramebuffer(gl, gl.FRAMEBUFFER, fb);
    let i = 0;
    const attachmentTextures = [];
    for (const attachment of attachments) {
        const tex = createTextureWithFormat(gl, attachment.texture, attachment.format);
        if (!tex.ok) return err("Failed to create framebuffer texture.");
        attachmentTextures.push(tex.data);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex.data, 0);
        i++;
    }
    return ok({
        framebuffer: fb,
        attachments: attachmentTextures
    });
}