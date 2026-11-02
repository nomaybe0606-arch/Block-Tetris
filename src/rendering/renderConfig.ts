/** Texture filtering stays on. Sprite quads do not need an extra multisampled framebuffer. */
export const RENDER={antialias:true,antialiasGL:false,pixelArt:false,roundPixels:false};
/** DOM Pointer Events own the gestures; Phaser must not run a second touch/mouse stack. */
export const ENGINE_INPUT={mouse:false,touch:false,keyboard:false,gamepad:false};
export function bufferRatio(displayScale:number,deviceRatio:number):number{
  return Math.max(.5,Math.min(1,displayScale))*Math.min(Math.max(1,deviceRatio||1),2);
}
