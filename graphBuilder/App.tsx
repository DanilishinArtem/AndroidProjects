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
// TODO: 3. Make names of: 3.1. Nodes, 3.2. Ports

// What have been done:
// 1. Added factory on nodes
// 2. Added complex animation of lines
// 3. Added floating meny for nodes
// 4. Added labels for nodes and menu
// 5. Added area selection and group dragging
// 6. Added feature (active node is on the front)
// 7. Added disconnection for links
// 8. Added constant movement at the border