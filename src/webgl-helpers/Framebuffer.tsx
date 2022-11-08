import { err, ok, Result } from "./Common";
import { createTextureWithFormat, TextureFormatOptions, TextureOptions } from "./Texture";

export const framebufferBindings = new Map<number, WebGLFramebuffer | null>();
export function bindFramebuffer(gl: WebGL2RenderingContext, target: number, framebuffer: WebGLFramebuffer | null) {
  if (framebufferBindings.get(target) !== framebuffer) {
    gl.bindFramebuffer(target, framebuffer);
    framebufferBindings.set(target, framebuffer);
  }
}

export type FramebufferWithAttachments = { 
    framebuffer: WebGLFramebuffer, 
    attachments: {
        tex: WebGLTexture,
        width: number,
        height: number
    }[], 
};

export function createFramebufferWithAttachments(
    gl: WebGL2RenderingContext,
    attachments: {
        texture: TextureOptions,
        format: TextureFormatOptions
    }[]
): Result<FramebufferWithAttachments, string> {
    const fb = gl.createFramebuffer();
    if (!fb) return err("Failed to create framebuffer.");
    bindFramebuffer(gl, gl.FRAMEBUFFER, fb);
    let i = 0;
    const attachmentTextures: FramebufferWithAttachments["attachments"] = [];
    for (const attachment of attachments) {
        const tex = createTextureWithFormat(gl, attachment.texture, attachment.format);
        if (!tex.ok) return err("Failed to create framebuffer texture.");
        attachmentTextures.push({
            tex: tex.data,
            width: attachment.format.width,
            height: attachment.format.height
        });
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, tex.data, 0);
        i++;
    }
    return ok({
        framebuffer: fb,
        attachments: attachmentTextures
    });
}