import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import type { PencilKitRef } from 'react-native-pencil-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChecklistCard from '../components/canvas/ChecklistCard';
import InkCanvas from '../components/canvas/InkCanvas';
import RegionSelector from '../components/canvas/RegionSelector';
import { captureRegion } from '../services/capture/regionCapture';
import { getChecklistForRegion } from '../services/claude/client';
import { ClaudeApiError } from '../services/claude/types';
import { persistImageFromUri } from '../services/storage/pageStore';
import { usePageStore } from '../state/usePageStore';
import type { RootStackParamList } from '../types/navigation';
import type { ChecklistAnnotation, Page, Region } from '../types/page';
import { generateId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'Page'>;

const DEFAULT_ASPECT_RATIO = 1.29; // ~US Letter portrait, height / width

export default function PageScreen({ route, navigation }: Props) {
  const { pageId } = route.params;
  const { pages, loaded, loadPages, updatePage } = usePageStore();
  const [page, setPage] = useState<Page | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const [requestingChecklist, setRequestingChecklist] = useState(false);

  const inkRef = useRef<PencilKitRef>(null);
  const inkLoadedForPageId = useRef<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const displayWidth = windowWidth - 32;

  useEffect(() => {
    if (!loaded) {
      loadPages();
    }
  }, [loaded, loadPages]);

  useEffect(() => {
    const found = pages.find((p) => p.id === pageId);
    if (found) {
      setPage(found);
    }
  }, [pages, pageId]);

  useEffect(() => {
    if (page && inkRef.current && page.inkBase64 && inkLoadedForPageId.current !== page.id) {
      inkLoadedForPageId.current = page.id;
      inkRef.current.loadBase64Data(page.inkBase64);
    }
  }, [page]);

  const displayHeight = page?.backgroundImageWidth
    ? (displayWidth * page.backgroundImageHeight) / page.backgroundImageWidth
    : displayWidth * DEFAULT_ASPECT_RATIO;

  const saveInk = useCallback(async () => {
    if (!page || !inkRef.current) return;
    const inkBase64 = await inkRef.current.getBase64Data();
    await updatePage({ ...page, inkBase64 });
  }, [page, updatePage]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        saveInk();
      };
    }, [saveInk]),
  );

  const handleImportPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to import a worksheet.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (result.canceled || !page) return;

    const asset = result.assets[0];
    const persistedUri = await persistImageFromUri(asset.uri, page.id);
    const updated: Page = {
      ...page,
      backgroundImageUri: persistedUri,
      backgroundImageWidth: asset.width,
      backgroundImageHeight: asset.height,
    };
    setPage(updated);
    await updatePage(updated);
  };

  const handleRegionSelected = async (region: Region) => {
    if (!page || !inkRef.current) return;
    setSelectionActive(false);

    if (!page.backgroundImageUri) {
      Alert.alert('Import a photo first', 'Checklist mode needs a worksheet photo to read the question from.');
      return;
    }

    setRequestingChecklist(true);
    try {
      const { backgroundBase64Png, inkBase64Png } = await captureRegion({
        backgroundImageUri: page.backgroundImageUri,
        backgroundImageWidth: page.backgroundImageWidth,
        backgroundImageHeight: page.backgroundImageHeight,
        displayWidth,
        displayHeight,
        inkRef: inkRef.current,
        region,
      });

      const steps = await getChecklistForRegion(backgroundBase64Png, inkBase64Png);

      const annotation: ChecklistAnnotation = {
        id: generateId(),
        kind: 'checklist',
        region,
        steps,
        createdAt: Date.now(),
      };
      const updated: Page = { ...page, annotations: [...page.annotations, annotation] };
      setPage(updated);
      await updatePage(updated);
    } catch (err) {
      if (err instanceof ClaudeApiError && err.kind === 'no_api_key') {
        Alert.alert('No API key', 'Add your Anthropic API key in Settings first.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ]);
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        Alert.alert('Checklist failed', message);
      }
    } finally {
      setRequestingChecklist(false);
    }
  };

  const handleDismissAnnotation = async (id: string) => {
    if (!page) return;
    const updated: Page = { ...page, annotations: page.annotations.filter((a) => a.id !== id) };
    setPage(updated);
    await updatePage(updated);
  };

  if (!page) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={handleImportPhoto}>
          <Text style={styles.toolbarButtonText}>Import Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarButton, selectionActive && styles.toolbarButtonActive]}
          onPress={() => setSelectionActive((active) => !active)}
        >
          <Text style={[styles.toolbarButtonText, selectionActive && styles.toolbarButtonTextActive]}>
            {selectionActive ? 'Drag to select question…' : 'Checklist'}
          </Text>
        </TouchableOpacity>
        {requestingChecklist ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator style={styles.toolbarSpinner} />
            <Text style={styles.thinkingText}>Wilbur is thinking…</Text>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.pageSurface, { width: displayWidth, height: displayHeight }]}>
          {page.backgroundImageUri ? (
            <Image
              source={{ uri: page.backgroundImageUri }}
              style={{ width: displayWidth, height: displayHeight }}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.placeholder, { width: displayWidth, height: displayHeight }]}>
              <Text style={styles.placeholderText}>Import a worksheet photo, or just write freely below.</Text>
            </View>
          )}

          <View style={StyleSheet.absoluteFill} pointerEvents={selectionActive ? 'none' : 'auto'}>
            <InkCanvas ref={inkRef} width={displayWidth} height={displayHeight} />
          </View>

          {page.annotations.map((annotation) => (
            <ChecklistCard key={annotation.id} annotation={annotation} onDismiss={handleDismissAnnotation} />
          ))}

          <RegionSelector
            active={selectionActive}
            width={displayWidth}
            height={displayHeight}
            onRegionSelected={handleRegionSelected}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  toolbarButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  toolbarButtonActive: {
    backgroundColor: '#3478F6',
  },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
  thinkingText: { fontSize: 12, color: '#666' },
  toolbarButtonText: { fontSize: 13, fontWeight: '600', color: '#333' },
  toolbarButtonTextActive: { color: '#fff' },
  toolbarSpinner: { marginLeft: 8 },
  scrollContent: { alignItems: 'center', paddingVertical: 16 },
  pageSurface: {
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    padding: 24,
  },
  placeholderText: { color: '#999', textAlign: 'center' },
});
