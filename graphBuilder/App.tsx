import React from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GraphApp from './src/components/graph/graph';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Просто вызываем ваш компонент как обычный тег */}
      <GraphApp />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111', // Цвет фона под стать вашей канве
  },
});

// TODO: 1. Add load and save buttons and logic
// TODO: 2. Make dynamic minimap (if we achieve edge of minimap we should shift green frame)
// TODO: 3. Make names of: 3.1. Nodes, 3.2. Ports