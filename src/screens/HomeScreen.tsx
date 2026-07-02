import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePageStore } from '../state/usePageStore';
import type { RootStackParamList } from '../types/navigation';
import type { Page } from '../types/page';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { pages, loaded, loadPages, createPage, updatePage, removePage } = usePageStore();

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleNewPage = async () => {
    const page = await createPage();
    navigation.navigate('Page', { pageId: page.id });
  };

  const handleRename = (page: Page) => {
    Alert.prompt(
      'Rename page',
      'Enter a new name for this page.',
      async (title) => {
        const trimmedTitle = title.trim();
        if (!trimmedTitle || trimmedTitle === page.title) return;

        try {
          await updatePage({ ...page, title: trimmedTitle });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Something went wrong.';
          Alert.alert('Rename failed', message);
        }
      },
      'plain-text',
      page.title,
    );
  };

  const handleDelete = (page: Page) => {
    Alert.alert('Delete page?', `"${page.title}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePage(page.id);
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Something went wrong.';
            Alert.alert('Delete failed', message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Image source={require('../../assets/wilbur-avatar.png')} style={styles.avatar} />
          <Text style={styles.title}>TruggTutor</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsLink}>Settings</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={pages}
        keyExtractor={(page) => page.id}
        contentContainerStyle={pages.length === 0 && styles.emptyContainer}
        ListEmptyComponent={
          loaded ? <Text style={styles.emptyText}>No pages yet. Tap "New Page" to start.</Text> : null
        }
        renderItem={({ item }) => (
          <View style={styles.pageRow}>
            <TouchableOpacity
              style={styles.pageOpenArea}
              onPress={() => navigation.navigate('Page', { pageId: item.id })}
            >
              <Text style={styles.pageTitle}>{item.title}</Text>
              <Text style={styles.pageMeta}>{new Date(item.updatedAt).toLocaleString()}</Text>
            </TouchableOpacity>
            <View style={styles.pageActions}>
              <TouchableOpacity style={styles.pageActionButton} onPress={() => handleRename(item)}>
                <Text style={styles.renameActionText}>Rename</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pageActionButton} onPress={() => handleDelete(item)}>
                <Text style={styles.deleteActionText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.newPageButton} onPress={handleNewPage}>
        <Text style={styles.newPageButtonText}>+ New Page</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  settingsLink: { color: '#3478F6', fontSize: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888' },
  pageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  pageOpenArea: { flex: 1, paddingVertical: 14 },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageActionButton: { paddingHorizontal: 8, paddingVertical: 10 },
  renameActionText: { color: '#3478F6', fontSize: 13, fontWeight: '600' },
  deleteActionText: { color: '#C7352D', fontSize: 13, fontWeight: '600' },
  pageTitle: { fontSize: 16, fontWeight: '600' },
  pageMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  newPageButton: {
    margin: 16,
    backgroundColor: '#3478F6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  newPageButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
