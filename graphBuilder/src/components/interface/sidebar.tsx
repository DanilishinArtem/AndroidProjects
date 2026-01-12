import React, { useState, useMemo} from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  SectionList,
  TextInput,
  Platform
} from 'react-native';

const CATEGORIES = [
  { title: 'Common', data: ['Code', 'Filter', 'Merge'] },
  { title: 'Events', data: ['FlashLight', 'Vibration'] },
  { title: 'Trigger', data: ['Webhook', 'Schedule', 'On App Event'] },
  { title: 'AI', data: ['AI Agent', 'OpenAI', 'Document Loader'] },
];

const SidebarItem = ({ label, onPress }) => (
  <TouchableOpacity onPress={() => onPress(label)} style={{ padding: 10, borderRadius: 8 }}>
    <Text style={{ color: '#fff' }}>{label}</Text>
  </TouchableOpacity>
);

export function Sidebar({ open, onClose, onAddNode }) {
  const [query, setQuery] = useState('');

  // filter sections by query (simple contains)
  const sections = useMemo(() => {
    if (!query) return CATEGORIES;
    const q = query.toLowerCase();
    return CATEGORIES.map(s => ({
      title: s.title,
      data: s.data.filter(d => d.toLowerCase().includes(q)),
    })).filter(s => s.data.length > 0);
  }, [query]);

  if (!open) return null;

  return (
    <View style={{
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 240,
      paddingTop: Platform.OS === 'ios' ? 48 : 20,
      paddingHorizontal: 12,
      backgroundColor: '#1f2937',
      zIndex: 2000,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 10
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>Nodes</Text>
        <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
          <Text style={{ color: '#9ca3af' }}>Close</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Search..."
        placeholderTextColor="#6b7280"
        value={query}
        onChangeText={setQuery}
        style={{
          height: 36,
          backgroundColor: '#111827',
          borderRadius: 8,
          paddingHorizontal: 10,
          color: '#fff',
          marginBottom: 10
        }}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => item + '_' + idx}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{ color: '#9ca3af', marginTop: 8, marginBottom: 6 }}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <SidebarItem label={item} onPress={(label) => onAddNode(label)} />
        )}
        stickySectionHeadersEnabled={false}
        initialNumToRender={10}
        windowSize={11}
        style={{ flex: 1 }}
      />
    </View>
  );
}