import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

import type { Region } from '../../types/page';

type RegionSelectorProps = {
  active: boolean;
  width: number;
  height: number;
  onRegionSelected: (region: Region) => void;
};

function normalize(startX: number, startY: number, currentX: number, currentY: number): Region {
  return {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

export default function RegionSelector({ active, width, height, onRegionSelected }: RegionSelectorProps) {
  const [draftRegion, setDraftRegion] = useState<Region | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => active,
      onMoveShouldSetPanResponder: () => active,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        startPoint.current = { x: locationX, y: locationY };
        setDraftRegion({ x: locationX, y: locationY, width: 0, height: 0 });
      },
      onPanResponderMove: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        setDraftRegion(normalize(startPoint.current.x, startPoint.current.y, locationX, locationY));
      },
      onPanResponderRelease: () => {
        setDraftRegion((current) => {
          if (current && current.width > 10 && current.height > 10) {
            onRegionSelected(current);
          }
          return null;
        });
      },
    }),
  ).current;

  return (
    <View
      style={[styles.overlay, { width, height }]}
      pointerEvents={active ? 'auto' : 'none'}
      {...panResponder.panHandlers}
    >
      {draftRegion ? (
        <View
          pointerEvents="none"
          style={[
            styles.selectionBox,
            {
              left: draftRegion.x,
              top: draftRegion.y,
              width: draftRegion.width,
              height: draftRegion.height,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  selectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#3478F6',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(52, 120, 246, 0.12)',
  },
});
