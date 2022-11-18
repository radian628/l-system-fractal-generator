import { err, ok, Result } from "./Common";
import { createTextureWithFormat, TextureFormatOptions, TextureOptions } from "./Texture";

export const framebufferBindings = new Map<number, WebGLFramebuffer | null>();
export function bindFramebuffer(gl: WebGL2RenderingContext, target: number, framebuffer: WebGLFramebuffer | null) {
  if (framebufferBindings.get(target) !== framebuffer) {
    gl.bindFramebuffer(target, framebuffer);
    framebufferBindings.set(target, framebuffer);
  }
}

export type TexWithDims = {
    tex: WebGLTexture,
    width: number,
    height: number
};

export type FramebufferWithAttachments = { 
    framebuffer: WebGLFramebuffer, 
    attachments: TexWithDims[], 
    depth?: TexWithDims
};

export function createFramebufferWithAttachments(
    gl: WebGL2RenderingContext,
    attachments: {
        texture: TextureOptions,
        format: TextureFormatOptions
    }[],
    depth?: {
        texture: TextureOptions,
        format: TextureFormatOptions
    }
): Result<FramebufferWithAttachments, string> {
    const fb = gl.createFramebuffer();
    if (!fb) return err("Failed to create framebuffer.");
    bindFramebuffer(gl, gl.FRAMEBUFFER, fb);
    let i = 0;
    const attachmentTextures: TexWithDims[] = [];

    function createAndBindAttachment(attachmentPoint: number, attachment: { texture: TextureOptions, format: TextureFormatOptions })
        : Result<TexWithDims, string> {
        const tex = createTextureWithFormat(gl, attachment.texture, attachment.format);
        if (!tex.ok) return tex;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, tex.data, 0);
        return ok({
            tex: tex.data,
            width: attachment.format.width,
            height: attachment.format.height
        });
    }

    for (const attachment of attachments) {
        const tex = createAndBindAttachment(gl.COLOR_ATTACHMENT0 + i, attachment);
        if (!tex.ok) return tex;
        attachmentTextures.push(tex.data);
        i++;
    }

    let depthTex = undefined;

    if (depth) {
        const tex = createAndBindAttachment(gl.DEPTH_ATTACHMENT, depth);
        if (!tex.ok) return tex;
        depthTex = tex;
    }

    return ok({
        framebuffer: fb,
        attachments: attachmentTextures,
        depth: depthTex?.data
    });
}