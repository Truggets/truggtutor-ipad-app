import type { Region } from '../../types/page';

/** Scales a region given in display points into source-image pixel coordinates. */
export function scaleRegion(region: Region, scale: number): Region {
  return {
    x: Math.round(region.x * scale),
    y: Math.round(region.y * scale),
    width: Math.round(region.width * scale),
    height: Math.round(region.height * scale),
  };
}

/** Clamps a pixel-space region so it never reads outside the source image bounds. */
export function clampRegion(region: Region, maxWidth: number, maxHeight: number): Region {
  const x = Math.max(0, Math.min(region.x, maxWidth - 1));
  const y = Math.max(0, Math.min(region.y, maxHeight - 1));
  const width = Math.max(1, Math.min(region.width, maxWidth - x));
  const height = Math.max(1, Math.min(region.height, maxHeight - y));
  return { x, y, width, height };
}
