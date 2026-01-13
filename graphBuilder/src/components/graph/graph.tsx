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
import { PORT_RADIUS } from '../nodes/Node';
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
  const [links, setLinks] = useState([]); // [{id, from, to, portFrom, portTo, additionalPort}]
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeMenu, setActiveMenu] = useState<{ nodeId: string; x: number; y: number ; width: number; height: number} | null>(null);

  // UI-thread shared storage (heavy coords etc)
  const nodesStore = useSharedValue({});

  // UI-state (shared values)
  const activeNodeId = useSharedValue(null);
  const isConnecting = useSharedValue(false);
  const tempLine = useSharedValue({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const startDragOffset = useSharedValue({ x: 0, y: 0 });

  const sourcePort = useSharedValue(null);
  const targetPort = useSharedValue(null);
  const additionalPort = useSharedValue(null);

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // SideBar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Generating id for a link (stable key)
  const makeLinkId = useCallback((from, to, portFrom, portTo, additionalPort) => `${from}__${to}__${portFrom}__${portTo}__${additionalPort}__${Date.now()}`, []);

  // mergeGraphs: Adding a link and merging graphs
  const mergeGraphs = useCallback((fromId, toId, portFrom, portTo, additionalPort) => {
    // protection from existing links (O(L))
    setLinks(prev => {
      const exists = prev.some(
        l =>
          l.from === fromId &&
          l.to === toId &&
          l.portFrom === portFrom &&
          l.portTo === portTo &&
          l.additionalPort === additionalPort
      );
  
      if (exists) return prev;
  
      return [
        ...prev,
        {
          id: makeLinkId(fromId, toId, portFrom, portTo, additionalPort),
          from: fromId,
          to: toId,
          portFrom,
          portTo,
          additionalPort,
        },
      ];
    });
    const targetGraphId = nodesStore.value[toId]?.graphId;
    const sourceGraphId = nodesStore.value[fromId]?.graphId;
    if (!targetGraphId || !sourceGraphId) return;
    // updating nodesStore on the UI thread (worklet)
    nodesStore.modify((val) => {
      'worklet';
      // change graphId for all source nodes
      for (const id in val) {
        if (val[id].graphId === sourceGraphId) val[id].graphId = targetGraphId;
      }
      return val;
    });

    setNodes(prev => prev.map(n => (n.graphId === sourceGraphId ? { ...n, graphId: targetGraphId } : n)));
    console.log(`added link from: ${fromId}, to: ${toId}, portFrom: ${portFrom}, portTo: ${portTo}, addPort: ${additionalPort}`)
  }, [nodesStore]);

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
  }, [links, nodes, recalculateGraphIds, nodesStore]);













  const nodeGestures = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;

        const store = nodesStore.value;
        for (const id in store) {
          const n = store[id];
          if(adjX >= n.x.value - PORT_RADIUS && adjX <= n.x.value + n.width + PORT_RADIUS && adjY >= n.y.value - PORT_RADIUS && adjY <= n.y.value + n.height + PORT_RADIUS){
            activeNodeId.value = id;
            for (let i = 0; i < n.outputPorts.length; i++) {
              const port = n.outputPorts[i];
              const portX = n.x.value + port.x;
              const portY = n.y.value + port.y;

              const distSq = (adjX - portX) * (adjX - portX) + (adjY - portY) * (adjY - portY);
              if (distSq <= PORT_RADIUS * PORT_RADIUS) {
                sourcePort.value = i;
                isConnecting.value = true;
                console.log(`Starting connection from node ${id}, port ${i}`);
                tempLine.value = {
                  x1: portX,
                  y1: portY,
                  x2: adjX,
                  y2: adjY
                };
                return;
              }
            }
            if (!isConnecting.value) {
              startDragOffset.value = { x: n.x.value, y: n.y.value };
            }
            break;
          }
        }
      })
      .onUpdate((e) => {
        runOnJS(setActiveMenu)(null);
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        if (!activeNodeId.value) return;
        if (isConnecting.value) {
          tempLine.value = {
            ...tempLine.value,
            x2: adjX,
            y2: adjY
          };
        } else {
          nodesStore.modify((val) => {
            'worklet';
            const id = activeNodeId.value;
            if (val[id]) {
              val[id].x.value = startDragOffset.value.x + (e.translationX / scale.value);
              val[id].y.value = startDragOffset.value.y + (e.translationY / scale.value);
            }
            return val;
          });
        }
      })
      .onFinalize((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        if (isConnecting.value) {
          let targetId = null;
          const store = nodesStore.value;
          for (const id in store) {
            const n = store[id];
            if(adjX >= n.x.value - PORT_RADIUS && adjX <= n.x.value + n.width + PORT_RADIUS && adjY >= n.y.value - PORT_RADIUS && adjY <= n.y.value + n.height + PORT_RADIUS){
              // Checking all input and additional ports to find the one under the touch
              const partsOfPorts = [n.inputPorts, n.additionalPorts];
              for (let p = 0; p < partsOfPorts.length; p++) {
                const ports = partsOfPorts[p];
                for (let i = 0; i < ports.length; i++){
                  const port = ports[i];
                  const portX = n.x.value + port.x;
                  const portY = n.y.value + port.y;
                  
                  const distSq = (adjX - portX) * (adjX - portX) + (adjY - portY) * (adjY - portY);
                  if (distSq <= PORT_RADIUS * PORT_RADIUS) {
                    targetPort.value = i;
                    additionalPort.value = p;
                    targetId = id;
                    break;
                  }
                }
              }
            }
          }
          if (targetId) runOnJS(mergeGraphs)(activeNodeId.value, targetId, sourcePort.value, targetPort.value, additionalPort.value);
        }

        nodesStore.modify((val) => {
          'worklet';
          if (activeNodeId.value && val[activeNodeId.value]) val[activeNodeId.value].isActive = 0;
          return val;
        });

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

            {links.map(l => (
              <RenderLink key={l.id} fromId={l.from} toId={l.to} portFrom={l.portFrom} portTo={l.portTo} additionalPort={l.additionalPort} store={nodesStore} />
            ))}
            <RenderTempLine tempLine={tempLine} isConnecting={isConnecting} />

            
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