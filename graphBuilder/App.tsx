// import React, { useMemo, useState } from 'react';
// import { View, StyleSheet } from 'react-native';
// import { Canvas, useFont } from '@shopify/react-native-skia';
// import { useSharedValue } from 'react-native-reanimated';
// import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
// import { nodeFactory, NodeRenderer } from './src/components/nodes/nodeFactory';
// import { NodeMenuOverlay } from './src/components/interface/nodeFloatMenu';
// import { runOnJS } from 'react-native-worklets';

// const App = () => {
//   const [activeMenu, setActiveMenu] = useState<{ nodeId: string; x: number; y: number ; width: number; height: number} | null>(null);
//   const font = useFont(require("./assets/fonts/Roboto_Condensed-BlackItalic.ttf"), 14);
//   // https://pictogrammers.com/library/mdi/
//   // https://github.com/callstack/react-native-material-palette/blob/master/example/android/app/src/main/assets/fonts/MaterialCommunityIcons.ttf
//   const iconFont = useFont(require("./assets/fonts/MaterialCommunityIcons.ttf"), 25);

//   const x1 = useSharedValue(100);
//   const y1 = useSharedValue(100);
//   const x2 = useSharedValue(100);
//   const y2 = useSharedValue(300);
//   const 

//   const startDragOffset = useSharedValue({x: 0, y: 0});
// // flashlight, 
  // const nodes = useMemo(() => [
  //   nodeFactory('AI Agent', 'node_1', 'graph_1', x1, y1),
  //   nodeFactory('OpenAI', 'node_2', 'graph_1', x2, y2),
  // ], []);

//   if (!font || !iconFont) return null;

//   const tapGesture = Gesture.Tap()
//     .onStart((event) => {
//       const { x, y } = event;
//       let foundNode = null;

//       // Проходим по нодам в обратном порядке (чтобы поймать верхнюю, если они перекрываются)
//       for (let i = nodes.length - 1; i >= 0; i--) {
//         const node = nodes[i];
//         const nx = node.x.value;
//         const ny = node.y.value;
//         const NODE_WIDTH = node.width;
//         const NODE_HEIGHT = node.height;

//         // Простая проверка попадания в Rect
//         if (x >= nx && x <= nx + NODE_WIDTH && y >= ny && y <= ny + NODE_HEIGHT) {
//           foundNode = { nodeId: node.nodeId, x: nx, y: ny, width: NODE_WIDTH, height: NODE_HEIGHT };
//           break;
//         }
//       }
//       runOnJS(setActiveMenu)(foundNode);
//     });

//   const panGesture = Gesture.Pan()
//     .onBegin((event) => {
//       const {x, y} = event;
//       let foundNode = null;
//       for(let i = nodes.length - 1; i >= 0; i--){
//         const node = nodes[i];
//         if(x >= node.x.value && x <= node.x.value + node.width && y >= node.y.value && y <= node.y.value + node.height){
//           foundNode = { nodeId: node.nodeId, x: node.x.value, y: node.y.value, width: node.width, height: node.height };
//           startDragOffset.value = {x: node.x.value, y: node.y.value};
//           break;
//         }
//       }
//     })
//     .onUpdate((event) => {
//       if(foundNode && foundNode.nodeId === 'node_1'){
//         return;
//       }else if()
//     })
//     .onFinalize((event) => {

//     });

  // const handleMenuAction = (action: string) => {
  //   console.log(`Action: ${action} for node: ${activeMenu?.nodeId}`);
  //   setActiveMenu(null);
  // };

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <View style={styles.container}>
//         <GestureDetector gesture={tapGesture}>
//           <Canvas style={styles.canvas}>
            // {nodes.map(node => (
            //   <NodeRenderer 
            //     key={node.nodeId} 
            //     node={node} 
            //     font={font} 
            //     iconFont={iconFont} 
            //   />
            // ))}
//           </Canvas>
//         </GestureDetector>
        
        // {activeMenu && (
        //   <NodeMenuOverlay
        //     visible={!!activeMenu}
        //     x={activeMenu.x}
        //     y={activeMenu.y}
        //     width={activeMenu.width}
        //     onAction={handleMenuAction}
        //   />
        // )}
//       </View>
//     </GestureHandlerRootView>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#white' },
//   canvas: { flex: 1 },
// });

// export default App;

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

// export default App;