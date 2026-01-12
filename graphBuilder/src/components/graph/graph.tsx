import React, { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, Platform, useWindowDimensions } from 'react-native';
import { Canvas, Group, useFont, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, clamp, withSpring, makeMutable } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MIN_SCALE, MAX_SCALE, NODE_SIZE, MINIMAP_SIZE, WORLD_SIZE,
  RenderMenu, RenderTempLine, RenderLink, RenderNode, MinimapNode, MinimapLink, styles
} from './RenderFunctions';


import { nodeFactory, NodeRenderer } from '../nodes/nodeFactory';


import { Sidebar } from '../interface/sidebar';
import { NodeMenuOverlay } from '../interface/nodeFloatMenu';
import { runOnJS } from 'react-native-worklets';
import { useDerivedValue } from 'react-native-reanimated';

import { NativeModules } from 'react-native';
const { GraphEngine } = NativeModules;

export default function GraphApp() {
  const MINIMAP_RATIO = MINIMAP_SIZE / WORLD_SIZE;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // React state: lists (lightweight)
  const [nodes, setNodes] = useState([]); // [{id, graphId, type}]
  const [links, setLinks] = useState([]); // [{id, from, to}]
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeMenu, setActiveMenu] = useState<{ nodeId: string; x: number; y: number ; width: number; height: number} | null>(null);

  // UI-thread shared storage (heavy coords etc)
  const nodesStore = useSharedValue({});

  // UI-state (shared values)
  const menuPos = useSharedValue({ x: 0, y: 0 });
  const activeNodeId = useSharedValue(null);
  const isConnecting = useSharedValue(false);
  const tempLine = useSharedValue({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const startDragOffset = useSharedValue({ x: 0, y: 0 });

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // SideBar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // addNodeOfType: create a node with a specific type & optional category
  const addNodeOfType = useCallback((type) => {
    const id = `n_${Date.now()}`;
    const graphId = `g_${id}`;
    
    const initX = (screenWidth / 4 - translateX.value) / scale.value;
    const initY = (screenHeight / 4 - translateY.value) / scale.value;
    
    const xSV = makeMutable(initX);
    const ySV = makeMutable(initY);
    
    const node = nodeFactory(type, id, graphId, xSV, ySV);

    nodesStore.modify((value) => {
      'worklet';
      value[id] = node;
      return value;
    });
    
    setNodes(prev => [...prev, { id, graphId, type }]);
    setSidebarOpen(false);
  }, [screenWidth, screenHeight, nodesStore, translateX, translateY, scale]);

  // recalculateGraphIds: Now it's O(N + L) — Throughput building maps for fast BFS
  const recalculateGraphIds = useCallback((currentNodes, currentLinks) => {
    const nodeMap = new Map(currentNodes.map(n => [n.id, { ...n }]));
    const adj = new Map();
    for (const l of currentLinks) {
      if (!adj.has(l.from)) adj.set(l.from, []);
      if (!adj.has(l.to)) adj.set(l.to, []);
      adj.get(l.from).push(l.to);
      adj.get(l.to).push(l.from);
    }

    const visited = new Set();
    const result = [];
    let counter = 1;

    for (const startNode of currentNodes) {
      const sid = startNode.id;
      if (visited.has(sid)) continue;

      const newGraphId = `g_n_${Math.round(Date.now() + counter)}`;
      counter += 1;

      const queue = [sid];
      visited.add(sid);

      while (queue.length > 0) {
        const nid = queue.shift();
        const node = nodeMap.get(nid);
        if (node) {
          result.push({ ...node, graphId: newGraphId });
        }
        const neighbors = adj.get(nid) || [];
        for (const nb of neighbors) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
    }

    // Important: if there were nodes without connections, they are also processed (they are included in the cycle)
    return result;
  }, []);

  // deleteNode: optimized, uses recalculateGraphIds
  const deleteNode = useCallback((nodeId) => {
    const idToDelete = nodeId;

    const updatedLinks = links.filter(l => l.from !== idToDelete && l.to !== idToDelete);
    const updatedNodes = nodes.filter(n => n.id !== idToDelete);

    const newNodes = recalculateGraphIds(updatedNodes, updatedLinks);

    // Updating nodesStore on the UI thread
    nodesStore.modify((val) => {
      'worklet';
      if (val[idToDelete]) delete val[idToDelete];
      for (const node of newNodes) {
        if (val[node.id]) val[node.id].graphId = node.graphId;
      }
      return val;
    });

    setLinks(updatedLinks);
    setNodes(newNodes);
    setMenuVisible(false);
    setSelectedNodeId(null);
  }, [links, nodes, recalculateGraphIds, nodesStore]);













  const nodeGestures = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;

        // if (menuVisible) {
        //   const mx = menuPos.value.x, my = menuPos.value.y;
        //   if (adjX >= mx + 10 && adjX <= mx + 70 && adjY >= my + 40 && adjY <= my + 70) {
        //     runOnJS(deleteNode)();
        //     return;
        //   }
        //   if (adjX >= mx + 80 && adjX <= mx + 140 && adjY >= my + 40 && adjY <= my + 70) {
        //     runOnJS(setMenuVisible)(false);
        //     return;
        //   }
        //   runOnJS(setMenuVisible)(false);
        //   return;
        // }

        const store = nodesStore.value;
        for (const id in store) {
          const n = store[id];
          if(adjX >= n.x.value && adjX <= n.x.value + n.width && adjY >= n.y.value && adjY <= n.y.value + n.height){
            activeNodeId.value = id;
            startDragOffset.value = { x: n.x.value, y: n.y.value };
            break;
          }

          // const left = n.x, top = n.y, right = n.x + NODE_SIZE, bottom = n.y + NODE_SIZE;
          // if (adjX >= left && adjX <= right && adjY >= top && adjY <= bottom) {
          //   activeNodeId.value = id;
          //   const isBottomEdge = adjY > bottom - 25;
          //   if (isBottomEdge) {
          //     isConnecting.value = true;
          //     tempLine.value = {
          //       x1: n.x + NODE_SIZE / 2,
          //       y1: n.y + NODE_SIZE,
          //       x2: adjX,
          //       y2: adjY
          //     };
          //   } else {
          //     startDragOffset.value = { x: n.x, y: n.y };
          //     nodesStore.modify((val) => {
          //       'worklet';
          //       if (val[id]) val[id].isActive = 1;
          //       return val;
          //     });
          //   }
          //   break;
          // }
        }
      })
      .onUpdate((e) => {
        runOnJS(setActiveMenu)(null);
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        if (!activeNodeId.value) return;

        nodesStore.modify((val) => {
          'worklet';
          const id = activeNodeId.value;
          if (val[id]) {
            val[id].x.value = startDragOffset.value.x + (e.translationX / scale.value);
            val[id].y.value = startDragOffset.value.y + (e.translationY / scale.value);
          }
          return val;
        });
        // if (isConnecting.value) {
        //   tempLine.value = {
        //     ...tempLine.value,
        //     x2: adjX,
        //     y2: adjY
        //   };
        // } else {
        //   nodesStore.modify((val) => {
        //     'worklet';
        //     const id = activeNodeId.value;
        //     if (val[id]) {
        //       val[id].x = startDragOffset.value.x + (e.translationX / scale.value);
        //       val[id].y = startDragOffset.value.y + (e.translationY / scale.value);
        //     }
        //     return val;
        //   });
        // }
      })
      .onFinalize((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        // if (isConnecting.value) {
        //   let targetId = null;
        //   const store = nodesStore.value;
        //   for (const id in store) {
        //     const n = store[id];
        //     if (id !== activeNodeId.value) {
        //       const left = n.x, top = n.y, right = n.x + NODE_SIZE, bottom = n.y + NODE_SIZE;
        //       if (adjX >= left && adjX <= right && adjY >= top && adjY <= bottom) {
        //         targetId = id;
        //         break;
        //       }
        //     }
        //   }
        //   if (targetId) runOnJS(mergeGraphs)(activeNodeId.value, targetId);
        // }

        // nodesStore.modify((val) => {
        //   'worklet';
        //   if (activeNodeId.value && val[activeNodeId.value]) val[activeNodeId.value].isActive = 0;
        //   return val;
        // });

        activeNodeId.value = null;
        isConnecting.value = false;
      });
  const tapGesture = Gesture.Tap()
    .onStart((e) => {
      const adjX = (e.x - translateX.value) / scale.value;
      const adjY = (e.y - translateY.value) / scale.value;
      let foundNode = null;

      // Проходим по нодам в обратном порядке (чтобы поймать верхнюю, если они перекрываются)
        const store = nodesStore.value;
        for (const id in store) {
          const n = store[id];
          if(adjX >= n.x.value && adjX <= n.x.value + n.width && adjY >= n.y.value && adjY <= n.y.value + n.height){
            foundNode = { nodeId: n.nodeId, x: n.x.value, y: n.y.value, width: n.width, height: n.height };
            break;
          }
        // Простая проверка попадания в Rect
      }
      runOnJS(setActiveMenu)(foundNode);
    });
      return Gesture.Race(pan, tapGesture);
  }, [
    menuVisible, nodesStore, translateX, translateY, scale,
    activeNodeId, isConnecting, tempLine, startDragOffset
  ]);

  const handleMenuAction = (action: string) => {
    console.log(`Action: ${action} for node: ${activeMenu?.nodeId}`);
    if (action === 'delete' && activeMenu) {
      deleteNode(activeMenu.nodeId);
    }
    runOnJS(setActiveMenu)(null);
  };


  const sceneTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  // font
  const font = useFont(require('../../../assets/fonts/Roboto_Condensed-BlackItalic.ttf'), 14);
  const iconFont = useFont(require("../../../assets/fonts/MaterialCommunityIcons.ttf"), 25);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>

        {/* Left sidebar */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onAddNode={(type) => addNodeOfType(type)} />

        {/* Top menu buttons */}
        <View style={[styles.menu, { marginLeft: sidebarOpen ? 240 : 0 }]}> 
          <TouchableOpacity style={styles.menuBtn} onPress={() => setSidebarOpen(v => !v)}>
            <Text style={styles.menuText}>{sidebarOpen ? 'Hide Library' : 'Show Library'}</Text>
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={nodeGestures}>
        <Canvas style={styles.canvas}>
          <Group transform={sceneTransform}>
            {nodes.map(n => {
              return (
                <NodeRenderer 
                  key={n.id} 
                  id={n.id}
                  store={nodesStore}
                  font={font} 
                  iconFont={iconFont} 
                />
              );
            })}

            <RenderMenu visible={menuVisible} pos={menuPos} font={font} nodeId={selectedNodeId} />
          </Group>
        </Canvas>
        </GestureDetector>

        {activeMenu && (
          <NodeMenuOverlay
            visible={!!activeMenu}
            x={activeMenu.x}
            y={activeMenu.y}
            width={activeMenu.width}
            onAction={handleMenuAction}
          />
        )}

      </View>
    </GestureHandlerRootView>
  );
}