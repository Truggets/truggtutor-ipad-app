import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearApiKey, getApiKey, setApiKey } from '../services/storage/secureConfig';

export default function SettingsScreen() {
  const [apiKey, setApiKeyInput] = useState('');
  const [savedKeyPresent, setSavedKeyPresent] = useState(false);

  useEffect(() => {
    getApiKey().then((key) => setSavedKeyPresent(!!key));
  }, []);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Enter an API key first.');
      return;
    }
    await setApiKey(apiKey.trim());
    setApiKeyInput('');
    setSavedKeyPresent(true);
    Alert.alert('Saved', 'Your Anthropic API key has been saved securely on this device.');
  };

  const handleClear = async () => {
    await clearApiKey();
    setSavedKeyPresent(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Anthropic API key</Text>
      <Text style={styles.hint}>
        {savedKeyPresent
          ? 'A key is currently saved on this device. Enter a new one to replace it.'
          : 'No key saved yet. Wilbur needs this to give you checklists.'}
      </Text>
      <TextInput
        style={styles.input}
        placeholder="sk-ant-..."
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        value={apiKey}
        onChangeText={setApiKeyInput}
      />
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save key</Text>
      </TouchableOpacity>
      {savedKeyPresent ? (
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Remove saved key</Text>
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  label: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 13, color: '#666', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: '#3478F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700' },
  clearButton: { marginTop: 12, alignItems: 'center' },
  clearButtonText: { color: '#C0392B' },
});
