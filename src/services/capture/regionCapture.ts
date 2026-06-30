import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PencilKitRef } from 'react-native-pencil-kit';
import type { Region } from '../../types/page';
import { clampRegion, scaleRegion } from './coordinates';

function toCropRect(region: Region) {
  return { originX: region.x, originY: region.y, width: region.width, height: region.height };
}

export type CaptureRegionParams = {
  /** The page's background image file uri, or null if the page has no background image yet. */
  backgroundImageUri: string | null;
  /** Natural pixel size of the background image. */
  backgroundImageWidth: number;
  backgroundImageHeight: number;
  /** Size, in display points, that the page (background + ink layer) is rendered at on screen. */
  displayWidth: number;
  displayHeight: number;
  /** Ref to the on-screen PencilKit canvas, same display size as displayWidth/displayHeight. */
  inkRef: PencilKitRef;
  /** Selected region, in display point coordinates (same space as the rendered canvas). */
  region: Region;
};

export type CaptureRegionResult = {
  backgroundBase64Png: string;
  inkBase64Png: string;
};

/**
 * Crops the background worksheet image and the student's ink to the same
 * on-screen region, as two separate PNGs, so both can be sent to Claude
 * without doing native layer compositing ourselves.
 */
export async function captureRegion(params: CaptureRegionParams): Promise<CaptureRegionResult> {
  const { backgroundImageUri, backgroundImageWidth, backgroundImageHeight, displayWidth, displayHeight, inkRef, region } =
    params;

  const clampedDisplayRegion = clampRegion(region, displayWidth, displayHeight);

  // The ink layer is exported at scale 1, so its pixel dimensions match the
  // on-screen display points exactly - no coordinate conversion needed.
  const fullInkPng = await inkRef.getBase64PngData({ scale: 1 });
  const inkResult = await ImageManipulator.manipulate(`data:image/png;base64,${fullInkPng}`)
    .crop(toCropRect(clampedDisplayRegion))
    .renderAsync();
  const inkSaved = await inkResult.saveAsync({ format: SaveFormat.PNG, base64: true });

  let backgroundBase64Png = '';
  if (backgroundImageUri) {
    const scale = backgroundImageWidth / displayWidth;
    const backgroundPixelRegion = clampRegion(
      scaleRegion(clampedDisplayRegion, scale),
      backgroundImageWidth,
      backgroundImageHeight,
    );
    const backgroundResult = await ImageManipulator.manipulate(backgroundImageUri)
      .crop(toCropRect(backgroundPixelRegion))
      .renderAsync();
    const backgroundSaved = await backgroundResult.saveAsync({ format: SaveFormat.PNG, base64: true });
    backgroundBase64Png = backgroundSaved.base64 ?? '';
  }

  return {
    backgroundBase64Png,
    inkBase64Png: inkSaved.base64 ?? '',
  };
}
