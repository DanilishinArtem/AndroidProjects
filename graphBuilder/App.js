// App.js
import React from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar } from 'react-native';
import GraphApp from './src/components/nodes/Graph';

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