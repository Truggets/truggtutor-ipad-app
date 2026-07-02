import { forwardRef } from 'react';
import { StyleSheet } from 'react-native';
import PencilKitView, { type PencilKitRef } from 'react-native-pencil-kit';

type InkCanvasProps = {
  width: number;
  height: number;
};

const InkCanvas = forwardRef<PencilKitRef, InkCanvasProps>(({ width, height }, ref) => {
  return (
    <PencilKitView
      ref={ref}
      style={[styles.canvas, { width, height }]}
      drawingPolicy="pencilonly"
      isOpaque={false}
      alwaysBounceVertical={false}
      alwaysBounceHorizontal={false}
    />
  );
});

InkCanvas.displayName = 'InkCanvas';

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: 'transparent',
  },
});

export default InkCanvas;
