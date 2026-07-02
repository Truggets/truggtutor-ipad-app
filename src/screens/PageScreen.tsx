import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import PdfPageImage from 'expo-pdf-page-image';
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

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

export default function PageScreen({ route, navigation }: Props) {
  const { pageId } = route.params;
  const { pages, loaded, loadPages, updatePage } = usePageStore();
  const [page, setPage] = useState<Page | null>(null);
  const [selectionActive, setSelectionActive] = useState(false);
  const [drawingTool, setDrawingTool] = useState<'pen' | 'eraserVector'>('pen');
  const [requestingChecklist, setRequestingChecklist] = useState(false);
  const [checkingAnnotationId, setCheckingAnnotationId] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const inkRef = useRef<PencilKitRef>(null);
  const inkLoadedForPageId = useRef<string | null>(null);
  const saveConfirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    return () => {
      if (saveConfirmationTimer.current) {
        clearTimeout(saveConfirmationTimer.current);
      }
    };
  }, []);

  const displayHeight = page?.backgroundImageWidth
    ? (displayWidth * page.backgroundImageHeight) / page.backgroundImageWidth
    : displayWidth * DEFAULT_ASPECT_RATIO;

  const saveInk = useCallback(async () => {
    if (!page || !inkRef.current) return;
    const inkBase64 = await inkRef.current.getBase64Data();
    await updatePage({ ...page, inkBase64 });
  }, [page, updatePage]);

  const handleSave = async () => {
    if (saveStatus === 'saving') return;

    if (saveConfirmationTimer.current) {
      clearTimeout(saveConfirmationTimer.current);
      saveConfirmationTimer.current = null;
    }

    setSaveStatus('saving');
    try {
      await saveInk();
      setSaveStatus('saved');
      saveConfirmationTimer.current = setTimeout(() => {
        setSaveStatus('idle');
        saveConfirmationTimer.current = null;
      }, 1600);
    } catch (err) {
      setSaveStatus('idle');
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Save failed', message);
    }
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        saveInk();
      };
    }, [saveInk]),
  );

  const handleImportFile = async () => {
    if (!page || importingFile) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;

      setImportingFile(true);
      const asset = result.assets[0];
      const isPdf = asset.mimeType === 'application/pdf' || asset.name.toLowerCase().endsWith('.pdf');

      let imageUri = asset.uri;
      let dimensions: { width: number; height: number };
      let renderedPageUris: string[] = [];

      if (isPdf) {
        const pages = await PdfPageImage.generateAllPages(asset.uri, 2);
        renderedPageUris = pages.map((p) => p.uri);
        const firstPage = pages[0];
        if (!firstPage) {
          throw new Error('The PDF has no pages to import.');
        }
        imageUri = firstPage.uri;
        dimensions = { width: firstPage.width, height: firstPage.height };
      } else {
        dimensions = await getImageDimensions(asset.uri);
      }

      const persistedUri = await persistImageFromUri(imageUri, page.id);
      if (renderedPageUris.length > 0) {
        await PdfPageImage.cleanupPages(renderedPageUris);
      }
      const updated: Page = {
        ...page,
        backgroundImageUri: persistedUri,
        backgroundImageWidth: dimensions.width,
        backgroundImageHeight: dimensions.height,
      };
      setPage(updated);
      await updatePage(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      Alert.alert('Import failed', message);
    } finally {
      setImportingFile(false);
    }
  };

  const handleDrawingToolSelected = (tool: 'pen' | 'eraserVector') => {
    setSelectionActive(false);
    setDrawingTool(tool);
    inkRef.current?.setTool({ toolType: tool });
  };

  const handleRegionSelected = async (region: Region) => {
    if (!page || !inkRef.current) return;
    setSelectionActive(false);

    if (!page.backgroundImageUri) {
      Alert.alert('Import a file first', 'Checklist mode needs a worksheet image or PDF.');
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

      const evaluation = await getChecklistForRegion(backgroundBase64Png, inkBase64Png);

      const annotation: ChecklistAnnotation = {
        id: generateId(),
        kind: 'checklist',
        region,
        steps: evaluation.steps,
        answer: evaluation.answer,
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

  const handleRecheckAnnotation = async (id: string) => {
    if (!page || !inkRef.current || requestingChecklist) return;
    const annotation = page.annotations.find((item) => item.id === id);
    if (!annotation || !page.backgroundImageUri) return;

    setRequestingChecklist(true);
    setCheckingAnnotationId(id);
    try {
      const { backgroundBase64Png, inkBase64Png } = await captureRegion({
        backgroundImageUri: page.backgroundImageUri,
        backgroundImageWidth: page.backgroundImageWidth,
        backgroundImageHeight: page.backgroundImageHeight,
        displayWidth,
        displayHeight,
        inkRef: inkRef.current,
        region: annotation.region,
      });
      const evaluation = await getChecklistForRegion(
        backgroundBase64Png,
        inkBase64Png,
        annotation.steps,
      );
      const updated: Page = {
        ...page,
        annotations: page.annotations.map((item) =>
          item.id === id
            ? { ...item, steps: evaluation.steps, answer: evaluation.answer }
            : item,
        ),
      };
      setPage(updated);
      await updatePage(updated);
    } catch (err) {
      if (err instanceof ClaudeApiError && err.kind === 'no_api_key') {
        Alert.alert('No API key', 'Add your Anthropic API key in Settings first.');
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        Alert.alert('Check failed', message);
      }
    } finally {
      setRequestingChecklist(false);
      setCheckingAnnotationId(null);
    }
  };

  const handleReorderAnnotation = async (id: string, direction: -1 | 1) => {
    if (!page) return;
    const index = page.annotations.findIndex((annotation) => annotation.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= page.annotations.length) return;

    const annotations = [...page.annotations];
    [annotations[index], annotations[targetIndex]] = [annotations[targetIndex], annotations[index]];
    const updated: Page = { ...page, annotations };
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
        <TouchableOpacity
          style={[styles.toolbarButton, saveStatus === 'saved' && styles.saveButtonSaved]}
          onPress={handleSave}
          disabled={saveStatus === 'saving'}
        >
          <Text style={styles.toolbarButtonText}>
            {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Save'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={handleImportFile}
          disabled={importingFile}
        >
          <Text style={styles.toolbarButtonText}>{importingFile ? 'Importing…' : 'Import File'}</Text>
        </TouchableOpacity>
        <View style={styles.toolStrip} accessibilityRole="toolbar">
          <TouchableOpacity
            style={[
              styles.toolButton,
              !selectionActive && drawingTool === 'pen' && styles.toolButtonActive,
            ]}
            onPress={() => handleDrawingToolSelected('pen')}
            accessibilityLabel="Pen"
            accessibilityRole="button"
            accessibilityState={{ selected: !selectionActive && drawingTool === 'pen' }}
          >
            <Text
              style={[
                styles.toolIcon,
                !selectionActive && drawingTool === 'pen' && styles.toolIconActive,
              ]}
            >
              ✎
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toolButton,
              !selectionActive && drawingTool === 'eraserVector' && styles.toolButtonActive,
            ]}
            onPress={() => handleDrawingToolSelected('eraserVector')}
            accessibilityLabel="Eraser"
            accessibilityRole="button"
            accessibilityState={{ selected: !selectionActive && drawingTool === 'eraserVector' }}
          >
            <Text
              style={[
                styles.toolIcon,
                !selectionActive && drawingTool === 'eraserVector' && styles.toolIconActive,
              ]}
            >
              ⌫
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolButton, selectionActive && styles.toolButtonActive]}
            onPress={() => setSelectionActive((active) => !active)}
            accessibilityLabel="Select question region"
            accessibilityRole="button"
            accessibilityState={{ selected: selectionActive }}
          >
            <Text style={[styles.scannerIcon, selectionActive && styles.toolIconActive]}>▱</Text>
          </TouchableOpacity>
        </View>
        {requestingChecklist ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator style={styles.toolbarSpinner} />
            <Text style={styles.thinkingText}>Wilbur is thinking…</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.workspace}>
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
                <Text style={styles.placeholderText}>Import a worksheet image or PDF, or write freely below.</Text>
              </View>
            )}

            <View style={StyleSheet.absoluteFill} pointerEvents={selectionActive ? 'none' : 'auto'}>
              <InkCanvas ref={inkRef} width={displayWidth} height={displayHeight} />
            </View>

            <RegionSelector
              active={selectionActive}
              width={displayWidth}
              height={displayHeight}
              onRegionSelected={handleRegionSelected}
            />
          </View>
        </ScrollView>

        {page.annotations.length > 0 ? (
          <View style={styles.checklistRail}>
            <ScrollView
              contentContainerStyle={styles.checklistRailContent}
              showsVerticalScrollIndicator={false}
            >
              {page.annotations.map((annotation) => (
                <ChecklistCard
                  key={annotation.id}
                  annotation={annotation}
                  checking={checkingAnnotationId === annotation.id}
                  onDismiss={handleDismissAnnotation}
                  onRecheck={handleRecheckAnnotation}
                  onReorder={handleReorderAnnotation}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
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
  toolStrip: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 9,
    backgroundColor: '#F0F0F0',
  },
  toolButton: {
    width: 36,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  toolButtonActive: {
    backgroundColor: '#3478F6',
  },
  toolIcon: { fontSize: 20, lineHeight: 22, color: '#333' },
  toolIconActive: { color: '#fff' },
  scannerIcon: { fontSize: 22, lineHeight: 23, color: '#333' },
  saveButtonSaved: {
    backgroundColor: '#DDF4E4',
  },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
  thinkingText: { fontSize: 12, color: '#666' },
  toolbarButtonText: { fontSize: 13, fontWeight: '600', color: '#333' },
  toolbarSpinner: { marginLeft: 8 },
  workspace: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingVertical: 16 },
  checklistRail: {
    position: 'absolute',
    left: 12,
    top: 12,
    bottom: 12,
    width: 280,
    zIndex: 10,
  },
  checklistRailContent: { gap: 12, paddingBottom: 16 },
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
