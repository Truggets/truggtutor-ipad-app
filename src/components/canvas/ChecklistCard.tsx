import { useRef } from 'react';
import { Animated, Image, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { ChecklistAnnotation } from '../../types/page';

type ChecklistCardProps = {
  annotation: ChecklistAnnotation;
  checking: boolean;
  onDismiss: (id: string) => void;
  onRecheck: (id: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
};

export default function ChecklistCard({
  annotation,
  checking,
  onDismiss,
  onRecheck,
  onReorder,
}: ChecklistCardProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const reorderRef = useRef(onReorder);
  reorderRef.current = onReorder;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
      onPanResponderMove: (_, gesture) => translateY.setValue(gesture.dy),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dy) > 36) {
          reorderRef.current(annotation.id, gesture.dy > 0 ? 1 : -1);
        }
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const allCorrect =
    annotation.steps.length > 0 && annotation.steps.every((step) => step.status === 'correct');

  return (
    <Animated.View style={[styles.card, { transform: [{ translateY }] }]}>
      <View style={styles.header} {...panResponder.panHandlers}>
        <View style={styles.titleRow}>
          <Image source={require('../../../assets/wilbur-avatar.png')} style={styles.avatar} />
          <Text style={styles.title}>Wilbur's checklist</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDismiss(annotation.id)}
          hitSlop={8}
          accessibilityLabel="Close checklist"
        >
          <Text style={styles.dismiss}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {annotation.steps.map((step, index) => {
          const correct = step.status === 'correct';
          const incorrect = step.status === 'incorrect';
          return (
            <View key={`${annotation.id}-${index}`} style={styles.stepRow}>
              <View
                style={[
                  styles.statusIndicator,
                  correct && styles.statusCorrect,
                  incorrect && styles.statusIncorrect,
                ]}
              >
                <Text style={[styles.statusText, (correct || incorrect) && styles.statusTextActive]}>
                  {correct ? '✓' : incorrect ? '!' : index + 1}
                </Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepText}>{step.text}</Text>
                {incorrect && step.hint ? (
                  <Text style={styles.hintText}>Hint: {step.hint}</Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {allCorrect && annotation.answer ? (
          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>Answer</Text>
            <Text style={styles.answerText}>{annotation.answer}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.checkButton, checking && styles.checkButtonDisabled]}
          onPress={() => onRecheck(annotation.id)}
          disabled={checking}
        >
          <Text style={styles.checkButtonText}>{checking ? 'Checking…' : 'Check my work'}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#FAF5FF',
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderRadius: 12,
    shadowColor: '#2E1065',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8B4FE',
    backgroundColor: '#F3E8FF',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  avatar: { width: 20, height: 20, borderRadius: 10 },
  title: { fontWeight: '700', fontSize: 13, color: '#2E1065' },
  dismiss: { fontSize: 20, lineHeight: 20, color: '#6B21A8', paddingHorizontal: 2 },
  body: { padding: 12, gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#A78BFA',
    backgroundColor: '#fff',
  },
  statusCorrect: { backgroundColor: '#15803D', borderColor: '#15803D' },
  statusIncorrect: { backgroundColor: '#B91C1C', borderColor: '#B91C1C' },
  statusText: { color: '#6B21A8', fontSize: 12, fontWeight: '800' },
  statusTextActive: { color: '#fff' },
  stepContent: { flex: 1 },
  stepText: { color: '#2E1065', fontSize: 13, lineHeight: 18 },
  hintText: { color: '#9F1239', fontSize: 12, lineHeight: 17, marginTop: 3 },
  answerBox: { borderRadius: 8, backgroundColor: '#DCFCE7', padding: 9 },
  answerLabel: { color: '#166534', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  answerText: { color: '#14532D', fontSize: 14, fontWeight: '600', marginTop: 2 },
  checkButton: { alignItems: 'center', borderRadius: 8, backgroundColor: '#7C3AED', paddingVertical: 9 },
  checkButtonDisabled: { opacity: 0.6 },
  checkButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
