import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Canvas, Rect, Circle, Line, Group, Paint } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, runOnJS, useDerivedValue } from 'react-native-reanimated';

const NODE_SIZE = 80;
const PORT_RADIUS = 6;

export default function GraphApp() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  
  const nodesStore = useSharedValue({});
  const activeNodeId = useSharedValue(null);
  const isConnecting = useSharedValue(false);
  const tempLine = useSharedValue({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const startDragOffset = useSharedValue({ x: 0, y: 0 });

  const addNewNode = () => {
    const id = `n_${Date.now()}`;
    const graphId = `g_${id}`;
    
    nodesStore.modify((value) => {
      'worklet';
      value[id] = { x: 150, y: 100, graphId, isActive: 0 };
      return value;
    });
    setNodes(prev => [...prev, { id, graphId }]);
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      const store = nodesStore.value;
      const ids = Object.keys(store);
      
      for (let i = ids.length - 1; i >= 0; i--) {
        const id = ids[i];
        const n = store[id];
        
        if (e.x >= n.x && e.x <= n.x + NODE_SIZE &&
            e.y >= n.y && e.y <= n.y + NODE_SIZE) {
          
          activeNodeId.value = id;
          // ПОРТ ВЫХОДА ТЕПЕРЬ СНИЗУ (y + NODE_SIZE)
          // Проверяем нажатие в нижней части ноды (нижние 20 пикселей)
          const isBottomEdge = e.y > n.y + NODE_SIZE - 25;

          if (isBottomEdge) {
            isConnecting.value = true;
            // Линия начинается в центре нижней грани
            tempLine.value = { x1: n.x + NODE_SIZE / 2, y1: n.y + NODE_SIZE, x2: e.x, y2: e.y };
          } else {
            startDragOffset.value = { x: n.x, y: n.y };
            nodesStore.modify((val) => {
              'worklet';
              val[id].isActive = 1;
              return val;
            });
          }
          break;
        }
      }
    })
    .onUpdate((e) => {
      if (!activeNodeId.value) return;
      if (isConnecting.value) {
        tempLine.value = { ...tempLine.value, x2: e.x, y2: e.y };
      } else {
        const store = nodesStore.value;
        const sourceNode = store[activeNodeId.value];
        nodesStore.modify((val) => {
          'worklet';
          Object.keys(val).forEach(id => {
            if (val[id].graphId === sourceNode.graphId) {
              val[id].x = startDragOffset.value.x + e.translationX;
              val[id].y = startDragOffset.value.y + e.translationY;
            }
          });
          return val;
        });
      }
    })
    .onFinalize((e) => {
      if (isConnecting.value) {
        let targetId = null;
        const store = nodesStore.value;
        Object.keys(store).forEach(id => {
          const n = store[id];
          // Попадание в любую область ноды (или можно ограничить верхней частью)
          if (id !== activeNodeId.value && 
              e.x >= n.x && e.x <= n.x + NODE_SIZE &&
              e.y >= n.y && e.y <= n.y + NODE_SIZE) {
            targetId = id;
          }
        });

        if (targetId) {
          runOnJS(setLinks)([...links, { from: activeNodeId.value, to: targetId }]);
        }
      }
      
      nodesStore.modify((val) => {
        'worklet';
        Object.keys(val).forEach(id => val[id].isActive = 0);
        return val;
      });
      activeNodeId.value = null;
      isConnecting.value = false;
    });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <GestureDetector gesture={pan}>
          <Canvas style={styles.canvas}>
            {links.map((l, i) => (
              <RenderLink key={i} fromId={l.from} toId={l.to} store={nodesStore} />
            ))}
            
            <RenderTempLine tempLine={tempLine} isConnecting={isConnecting} />

            {nodes.map(n => (
              <RenderNode key={n.id} id={n.id} store={nodesStore} />
            ))}
          </Canvas>
        </GestureDetector>
        <TouchableOpacity style={styles.btn} onPress={addNewNode}>
          <Text style={{color:'#fff', fontWeight:'bold'}}>+ ADD STEP</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const RenderNode = ({ id, store }) => {
  const x = useDerivedValue(() => store.value[id]?.x ?? 0);
  const y = useDerivedValue(() => store.value[id]?.y ?? 0);
  const active = useDerivedValue(() => store.value[id]?.isActive ?? 0);

  return (
    <Group>
      {/* Основное тело ноды */}
      <Rect x={x} y={y} width={NODE_SIZE} height={NODE_SIZE} color="#222" r={12}>
        <Paint style="stroke" strokeWidth={2} color="cyan" opacity={active} />
      </Rect>
      
      {/* Точка входа (Сверху по центру) */}
      <Circle 
        cx={useDerivedValue(() => x.value + NODE_SIZE / 2)} 
        cy={y} 
        r={PORT_RADIUS} 
        color="#555" 
      >
        <Paint style="stroke" strokeWidth={1} color="cyan" />
      </Circle>

      {/* Точка выхода (Снизу по центру) */}
      <Circle 
        cx={useDerivedValue(() => x.value + NODE_SIZE / 2)} 
        cy={useDerivedValue(() => y.value + NODE_SIZE)} 
        r={PORT_RADIUS} 
        color="cyan" 
      />
    </Group>
  );
};

const RenderLink = ({ fromId, toId, store }) => {
  // Линия идет от НИЗА верхней ноды к ВЕРХУ нижней ноды
  const p1 = useDerivedValue(() => ({ 
    x: (store.value[fromId]?.x ?? 0) + NODE_SIZE / 2, 
    y: (store.value[fromId]?.y ?? 0) + NODE_SIZE 
  }));
  const p2 = useDerivedValue(() => ({ 
    x: (store.value[toId]?.x ?? 0) + NODE_SIZE / 2, 
    y: (store.value[toId]?.y ?? 0) 
  }));
  return <Line p1={p1} p2={p2} color="cyan" strokeWidth={2} />;
};

const RenderTempLine = ({ tempLine, isConnecting }) => {
  const p1 = useDerivedValue(() => ({ x: tempLine.value.x1, y: tempLine.value.y1 }));
  const p2 = useDerivedValue(() => ({ x: tempLine.value.x2, y: tempLine.value.y2 }));
  const opacity = useDerivedValue(() => isConnecting.value ? 1 : 0);
  return <Line p1={p1} p2={p2} color="white" strokeWidth={2} opacity={opacity} strokeCap="round" />;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  canvas: { flex: 1 },
  btn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, borderWidth: 1, borderColor: '#333' }
});
