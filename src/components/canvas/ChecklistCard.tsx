import { useRef, useState } from 'react';
import { Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ChecklistAnnotation } from '../../types/page';

type ChecklistCardProps = {
  annotation: ChecklistAnnotation;
  onDismiss: (id: string) => void;
};

export default function ChecklistCard({ annotation, onDismiss }: ChecklistCardProps) {
  const anchorLeft = annotation.region.x + annotation.region.width + 12;
  const anchorTop = annotation.region.y;

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [dragging, setDragging] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => setDragging(true),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => setDragging(false),
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.card,
        dragging && styles.cardDragging,
        { left: anchorLeft, top: anchorTop, transform: pan.getTranslateTransform() },
      ]}
    >
      <View style={styles.header} {...panResponder.panHandlers}>
        <View style={styles.titleRow}>
          <Image source={require('../../../assets/wilbur-avatar.png')} style={styles.avatar} />
          <Text style={styles.title}>Wilbur's checklist</Text>
        </View>
        <TouchableOpacity onPress={() => onDismiss(annotation.id)} hitSlop={8}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </View>
      {annotation.steps.map((step, index) => (
        <Text key={index} style={styles.step}>
          {index + 1}. {step}
        </Text>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: 240,
    backgroundColor: '#FFFDF2',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  cardDragging: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 18, height: 18, borderRadius: 9 },
  title: {
    fontWeight: '700',
    fontSize: 13,
    color: '#444',
  },
  dismiss: {
    fontSize: 14,
    color: '#888',
    paddingHorizontal: 4,
  },
  step: {
    fontSize: 13,
    color: '#222',
    marginBottom: 4,
  },
});
