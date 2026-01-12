import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Canvas, useFont } from '@shopify/react-native-skia';
import { useSharedValue } from 'react-native-reanimated';
import { NodeView, createNode, NodeData } from './src/components/nodes/Node';

const App = () => {
  const font = useFont(require("./assets/fonts/Roboto_Condensed-BlackItalic.ttf"), 14);
  // https://pictogrammers.com/library/mdi/
  // https://github.com/callstack/react-native-material-palette/blob/master/example/android/app/src/main/assets/fonts/MaterialCommunityIcons.ttf
  const iconFont = useFont(require("./assets/fonts/MaterialCommunityIcons.ttf"), 25);

  const x1 = useSharedValue(100);
  const y1 = useSharedValue(150);

  // Исправлено: используем createNode правильно для инициализации объектов
  const nodes: NodeData[] = useMemo(() => [
    createNode({
      nodeId: 'n1',
      label: 'code',
      color: '#ffffff',
      inputCount: 2,
      outputCount: 1,
      x: x1,
      y: y1,
    }),
  ], [x1, y1]);

  // ВАЖНО: Ждем загрузки ОБОИХ шрифтов перед рендером Canvas
  if (!font || !iconFont) {
    return null; 
  }

  return (
    <View style={{ flex: 1 }}>
      <Canvas style={{ flex: 1 }}>
        {nodes.map((node) => (
          <NodeView 
            key={node.nodeId} 
            node={node} 
            font={font} 
            iconFont={iconFont} 
          />
        ))}
      </Canvas>
    </View>
  );
};

export default App;
