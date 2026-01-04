import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Canvas, Rect, Circle, Line, Group, Paint, Text as SkiaText, useFont } from '@shopify/react-native-skia';
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

  const mergeGraphs = (fromId, toId) => {
    setLinks(prev => [...prev, { from: fromId, to: toId }]);
    
    // Оставляем логику обновления graphId для информации в тексте, 
    // но теперь это не влияет на перетаскивание
    const targetGraphId = nodesStore.value[toId]?.graphId;
    const sourceGraphId = nodesStore.value[fromId]?.graphId;
    if (!targetGraphId || !sourceGraphId || targetGraphId === sourceGraphId) return;

    nodesStore.modify((val) => {
      'worklet';
      Object.keys(val).forEach(id => {
        if (val[id].graphId === sourceGraphId) val[id].graphId = targetGraphId;
      });
      return val;
    });

    setNodes(prev => prev.map(n => 
      n.graphId === sourceGraphId ? { ...n, graphId: targetGraphId } : n
    ));
  };

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
      for (const id in store) {
        const n = store[id];
        if (e.x >= n.x && e.x <= n.x + NODE_SIZE && e.y >= n.y && e.y <= n.y + NODE_SIZE) {
          activeNodeId.value = id;
          const isBottomEdge = e.y > n.y + NODE_SIZE - 25;

          if (isBottomEdge) {
            isConnecting.value = true;
            tempLine.value = { x1: n.x + NODE_SIZE / 2, y1: n.y + NODE_SIZE, x2: e.x, y2: e.y };
          } else {
            startDragOffset.value = { x: n.x, y: n.y };
            nodesStore.modify((val) => {
              'worklet';
              if (val[id]) val[id].isActive = 1;
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
        nodesStore.modify((val) => {
          'worklet';
          // ИСПРАВЛЕНО: Изменяем координаты только ОДНОЙ активной ноды
          const id = activeNodeId.value;
          if (val[id]) {
            val[id].x = startDragOffset.value.x + e.translationX;
            val[id].y = startDragOffset.value.y + e.translationY;
          }
          return val;
        });
      }
    })
    .onFinalize((e) => {
      if (isConnecting.value) {
        let targetId = null;
        const store = nodesStore.value;
        for (const id in store) {
          const n = store[id];
          if (id !== activeNodeId.value && e.x >= n.x && e.x <= n.x + NODE_SIZE && e.y >= n.y && e.y <= n.y + NODE_SIZE) {
            targetId = id;
            break;
          }
        }
        if (targetId) runOnJS(mergeGraphs)(activeNodeId.value, targetId);
      }
      
      nodesStore.modify((val) => {
        'worklet';
        if (activeNodeId.value && val[activeNodeId.value]) {
          val[activeNodeId.value].isActive = 0;
        }
        return val;
      });
      activeNodeId.value = null;
      isConnecting.value = false;
    });

  const font = useFont(require('../../../assets/fonts/Roboto_Condensed-BlackItalic.ttf'), 11);

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
              <RenderNode 
                key={n.id} id={n.id} store={nodesStore} font={font} 
                incoming={links.filter(l => l.to === n.id).map(l => l.from.slice(-4)).join(',')}
                outgoing={links.filter(l => l.from === n.id).map(l => l.to.slice(-4)).join(',')}
              />
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

const RenderNode = ({ id, store, font, incoming, outgoing }) => {
  const x = useDerivedValue(() => store.value[id]?.x ?? 0);
  const y = useDerivedValue(() => store.value[id]?.y ?? 0);
  const active = useDerivedValue(() => store.value[id]?.isActive ?? 0);
  const graphId = useDerivedValue(() => store.value[id]?.graphId ?? '');

  return (
    <Group>
      <Rect x={x} y={y} width={NODE_SIZE} height={NODE_SIZE} color="#333" r={12} />
      <Group>
        <Paint style="stroke" strokeWidth={2} color="cyan" opacity={active} />
        <Rect x={x} y={y} width={NODE_SIZE} height={NODE_SIZE} r={12} />
      </Group>
      <Group color="white">
        <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 20)} text={`ID: ${id.slice(-4)}`} />
        <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 35)} text={useDerivedValue(() => `G_ID: ${graphId.value.slice(-4)}`)} />
        <Group color="#aaa">
            <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 55)} text={`In: ${incoming || 'none'}`} />
            <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 70)} text={`Out: ${outgoing || 'none'}`} />
        </Group>
      </Group>
      <Circle cx={useDerivedValue(() => x.value + NODE_SIZE / 2)} cy={y} r={PORT_RADIUS} color="#555">
        <Paint style="stroke" strokeWidth={1} color="cyan" />
      </Circle>
      <Circle cx={useDerivedValue(() => x.value + NODE_SIZE / 2)} cy={useDerivedValue(() => y.value + NODE_SIZE)} r={PORT_RADIUS} color="cyan" />
    </Group>
  );
};

const RenderLink = ({ fromId, toId, store }) => {
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
