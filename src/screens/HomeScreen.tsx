import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePageStore } from '../state/usePageStore';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { pages, loaded, loadPages, createPage } = usePageStore();

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleNewPage = async () => {
    const page = await createPage();
    navigation.navigate('Page', { pageId: page.id });
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
          <TouchableOpacity
            style={styles.pageRow}
            onPress={() => navigation.navigate('Page', { pageId: item.id })}
          >
            <Text style={styles.pageTitle}>{item.title}</Text>
            <Text style={styles.pageMeta}>{new Date(item.updatedAt).toLocaleString()}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
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
