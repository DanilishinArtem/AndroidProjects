import React, { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, useWindowDimensions } from 'react-native';
import { Canvas, Group, useFont, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, clamp, withSpring } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MIN_SCALE, MAX_SCALE, NODE_SIZE, MINIMAP_SIZE, WORLD_SIZE,
  RenderMenu, RenderTempLine, RenderLink, RenderNode, MinimapNode, MinimapLink, styles
} from './RenderFunctions';
import { runOnJS } from 'react-native-worklets';
import { useDerivedValue } from 'react-native-reanimated';

export default function GraphApp() {
  const MINIMAP_RATIO = MINIMAP_SIZE / WORLD_SIZE;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // React state: lists (lightweight)
  const [nodes, setNodes] = useState([]); // [{id, graphId}]
  const [links, setLinks] = useState([]); // [{id, from, to}]
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // UI-thread shared storage (heavy coords etc)
  const nodesStore = useSharedValue({});

  // UI-state (shared values)
  const menuPos = useSharedValue({ x: 0, y: 0 });
  const activeNodeId = useSharedValue(null);
  const isConnecting = useSharedValue(false);
  const tempLine = useSharedValue({ x1: 0, y1: 0, x2: 0, y2: 0 });
  const startDragOffset = useSharedValue({ x: 0, y: 0 });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const pinchCenter = useSharedValue({ x: 0, y: 0 });
  const isPinching = useSharedValue(false);

  // ---------- Helpers optimized ----------
  // Generating id for a link (stable key)
  const makeLinkId = useCallback((from, to) => `${from}__${to}__${Date.now()}`, []);

  // mergeGraphs: Adding a link and merging graphs
  const mergeGraphs = useCallback((fromId, toId) => {
    if (fromId === toId) return;

    // protection from existing links (O(L))
    const exists = links.some(
      l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId)
    );
    if (exists) return;

    const newLink = { id: makeLinkId(fromId, toId), from: fromId, to: toId };
    setLinks(prev => [...prev, newLink]);

    const targetGraphId = nodesStore.value[toId]?.graphId;
    const sourceGraphId = nodesStore.value[fromId]?.graphId;
    if (!targetGraphId || !sourceGraphId || targetGraphId === sourceGraphId) return;

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
  }, [links, makeLinkId, nodesStore]);

  // addNewNode
  const addNewNode = useCallback(() => {
    const id = `n_${Date.now()}`;
    const graphId = `g_${id}`;

    const centerX = (screenWidth / 4 - translateX.value) / scale.value;
    const centerY = (screenHeight / 4 - translateY.value) / scale.value;

    nodesStore.modify((value) => {
      'worklet';
      value[id] = { x: centerX, y: centerY, graphId, isActive: 0 };
      return value;
    });

    setNodes(prev => [...prev, { id, graphId }]);
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
  const deleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    const idToDelete = selectedNodeId;

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
  }, [selectedNodeId, links, nodes, recalculateGraphIds, nodesStore]);

  // save/load
  const saveGraph = useCallback(async () => {
    try {
      const dataToSave = { nodes, links, coords: nodesStore.value };
      await AsyncStorage.setItem('@my_graph_data', JSON.stringify(dataToSave));
      alert('Graph is saved!');
    } catch (e) {
      console.error('Error saving graph', e);
    }
  }, [nodes, links, nodesStore]);

  const loadGraph = useCallback(async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('@my_graph_data');
      if (!jsonValue) return;
      const savedData = JSON.parse(jsonValue);

      nodesStore.modify((val) => {
        'worklet';
        // clear and rewrite
        for (const k in val) delete val[k];
        Object.assign(val, savedData.coords);
        return val;
      });

      setNodes(savedData.nodes);
      setLinks(savedData.links);
      alert('Graph is loaded!');
    } catch (e) {
      console.error('Error loading graph', e);
    }
  }, [nodesStore]);

  // ---------- Precompute incoming/outgoing strings (useMemo) ----------
  const { incomingStrMap, outgoingStrMap } = useMemo(() => {
    const inc = Object.create(null);
    const out = Object.create(null);
    for (const l of links) {
      if (!inc[l.to]) inc[l.to] = [];
      inc[l.to].push(l.from);
      if (!out[l.from]) out[l.from] = [];
      out[l.from].push(l.to);
    }
    const incStr = Object.create(null);
    const outStr = Object.create(null);
    for (const k in inc) incStr[k] = inc[k].map(a => a.slice(-4)).join(',');
    for (const k in out) outStr[k] = out[k].map(a => a.slice(-4)).join(',');
    return { incomingStrMap: incStr, outgoingStrMap: outStr };
  }, [links]);

  // ---------- Gestures (useMemo) ----------
  // Node pan / connect / longPress
  const nodeGestures = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;

        if (menuVisible) {
          const mx = menuPos.value.x, my = menuPos.value.y;
          if (adjX >= mx + 10 && adjX <= mx + 70 && adjY >= my + 40 && adjY <= my + 70) {
            runOnJS(deleteNode)();
            return;
          }
          if (adjX >= mx + 80 && adjX <= mx + 140 && adjY >= my + 40 && adjY <= my + 70) {
            runOnJS(setMenuVisible)(false);
            return;
          }
          runOnJS(setMenuVisible)(false);
          return;
        }

        const store = nodesStore.value;
        for (const id in store) {
          const n = store[id];
          const left = n.x, top = n.y, right = n.x + NODE_SIZE, bottom = n.y + NODE_SIZE;
          if (adjX >= left && adjX <= right && adjY >= top && adjY <= bottom) {
            activeNodeId.value = id;
            const isBottomEdge = adjY > bottom - 25;
            if (isBottomEdge) {
              isConnecting.value = true;
              tempLine.value = {
                x1: n.x + NODE_SIZE / 2,
                y1: n.y + NODE_SIZE,
                x2: adjX,
                y2: adjY
              };
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
              val[id].x = startDragOffset.value.x + (e.translationX / scale.value);
              val[id].y = startDragOffset.value.y + (e.translationY / scale.value);
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
            if (id !== activeNodeId.value) {
              const left = n.x, top = n.y, right = n.x + NODE_SIZE, bottom = n.y + NODE_SIZE;
              if (adjX >= left && adjX <= right && adjY >= top && adjY <= bottom) {
                targetId = id;
                break;
              }
            }
          }
          if (targetId) runOnJS(mergeGraphs)(activeNodeId.value, targetId);
        }

        nodesStore.modify((val) => {
          'worklet';
          if (activeNodeId.value && val[activeNodeId.value]) val[activeNodeId.value].isActive = 0;
          return val;
        });

        activeNodeId.value = null;
        isConnecting.value = false;
      });

    const longPress = Gesture.LongPress()
      .onStart((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        const store = nodesStore.value;
        for (const id in store) {
          const n = store[id];
          const left = n.x, top = n.y, right = n.x + NODE_SIZE, bottom = n.y + NODE_SIZE;
          if (adjX >= left && adjX <= right && adjY >= top && adjY <= bottom) {
            menuPos.value = { x: adjX, y: adjY };
            runOnJS(setSelectedNodeId)(id);
            runOnJS(setMenuVisible)(true);
            break;
          }
        }
      });

    return Gesture.Race(pan, longPress);
  }, [
    menuVisible, nodesStore, deleteNode, translateX, translateY, scale,
    activeNodeId, isConnecting, tempLine, startDragOffset, mergeGraphs
  ]);

  // Canvas gestures (pan + pinch)
  const canvasGesture = useMemo(() => {
    const canvasPan = Gesture.Pan()
      .minPointers(2)
      .onStart(() => {
        if (isPinching.value || activeNodeId.value !== null) return;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        if (isPinching.value || activeNodeId.value !== null) return;
        const nextX = savedTranslateX.value + e.translationX;
        const nextY = savedTranslateY.value + e.translationY;
        translateX.value = withSpring(nextX);
        translateY.value = withSpring(nextY);
      });

    const canvasPinch = Gesture.Pinch()
      .onStart((e) => {
        isPinching.value = true;
        savedScale.value = scale.value;
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
        pinchCenter.value = {
          x: (e.focalX - translateX.value) / scale.value,
          y: (e.focalY - translateY.value) / scale.value
        };
      })
      .onUpdate((e) => {
        let nextScale = savedScale.value * e.scale;
        if (nextScale < MIN_SCALE) nextScale = MIN_SCALE;
        if (nextScale > MAX_SCALE) nextScale = MAX_SCALE;
        translateX.value = savedTranslateX.value - pinchCenter.value.x * (nextScale - savedScale.value);
        translateY.value = savedTranslateY.value - pinchCenter.value.y * (nextScale - savedScale.value);
        scale.value = nextScale;
      })
      .onEnd(() => {
        isPinching.value = false;
      });

    return Gesture.Simultaneous(canvasPan, canvasPinch);
  }, [
    isPinching, activeNodeId, savedTranslateX, savedTranslateY,
    translateX, translateY, scale, savedScale, pinchCenter
  ]);

  const composedGesture = useMemo(() => Gesture.Simultaneous(nodeGestures, canvasGesture), [nodeGestures, canvasGesture]);

  // ---------- Minimap derived values ----------
  const vX = useDerivedValue(() => {
    const s = scale.value || 1;
    const w = ((screenWidth - 100) / s) * MINIMAP_RATIO;
    const rawX = (-translateX.value / s) * MINIMAP_RATIO + (MINIMAP_SIZE / 2);
    return clamp(rawX, 0, MINIMAP_SIZE - w);
  });

  const vY = useDerivedValue(() => {
    const s = scale.value || 1;
    const h = (screenHeight / s) * MINIMAP_RATIO;
    const rawY = (-translateY.value / s) * MINIMAP_RATIO + (MINIMAP_SIZE / 2);
    return clamp(rawY, 0, MINIMAP_SIZE - h);
  });

  const vW = useDerivedValue(() => {
    const w = (screenWidth / (scale.value || 1)) * MINIMAP_RATIO;
    return Math.min(w, MINIMAP_SIZE);
  });

  const vH = useDerivedValue(() => {
    const h = (screenHeight / (scale.value || 1)) * MINIMAP_RATIO;
    return Math.min(h, MINIMAP_SIZE);
  });

  const minimapGesture = useMemo(() => Gesture.Pan().onUpdate((e) => {
    const clampedX = clamp(e.x, vW.value / 2, MINIMAP_SIZE - vW.value / 2);
    const clampedY = clamp(e.y, vH.value / 2, MINIMAP_SIZE - vH.value / 2);
    const targetWorldX = (clampedX / MINIMAP_RATIO) - (WORLD_SIZE / 2);
    const targetWorldY = (clampedY / MINIMAP_RATIO) - (WORLD_SIZE / 2);
    const nextX = -targetWorldX * scale.value + (screenWidth / 2);
    const nextY = -targetWorldY * scale.value + (screenHeight / 2);
    translateX.value = withSpring(nextX);
    translateY.value = withSpring(nextY);
  }), [vW, vH, scale, translateX, translateY, screenWidth, screenHeight]);

  const minimapContentTransform = [{ scale: MINIMAP_RATIO }, { translateX: WORLD_SIZE / 2 }, { translateY: WORLD_SIZE / 2 }];

  const sceneTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  // font
  const font = useFont(require('../../../assets/fonts/Roboto_Condensed-BlackItalic.ttf'), 11);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuBtn} onPress={saveGraph}>
            <Text style={styles.menuText}>SAVE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuBtn} onPress={loadGraph}>
            <Text style={styles.menuText}>LOAD</Text>
          </TouchableOpacity>
        </View>

        <GestureDetector gesture={composedGesture}>
          <Canvas style={styles.canvas}>
            <Group transform={sceneTransform}>
              {links.map(l => (
                <RenderLink key={l.id} fromId={l.from} toId={l.to} store={nodesStore} />
              ))}

              <RenderTempLine tempLine={tempLine} isConnecting={isConnecting} />

              {nodes.map(n => (
                <RenderNode
                  key={n.id}
                  id={n.id}
                  store={nodesStore}
                  font={font}
                  incoming={incomingStrMap[n.id] || ''}
                  outgoing={outgoingStrMap[n.id] || ''}
                />
              ))}

              <RenderMenu visible={menuVisible} pos={menuPos} font={font} nodeId={selectedNodeId} />
            </Group>
          </Canvas>
        </GestureDetector>

        <GestureDetector gesture={minimapGesture}>
          <View style={styles.minimapContainer}>
            <Canvas style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE }}>
              <Group transform={minimapContentTransform}>
                {nodes.map(n => <MinimapNode key={n.id} id={n.id} store={nodesStore} OFF={-10000} />)}
                {links.map(l => <MinimapLink key={`ml-${l.id}`} fromId={l.from} toId={l.to} store={nodesStore} />)}
              </Group>
              <Rect x={vX} y={vY} width={vW} height={vH} color="green" style="stroke" strokeWidth={2} />
            </Canvas>
          </View>
        </GestureDetector>

        <TouchableOpacity style={styles.btn} onPress={addNewNode}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ ADD NODE</Text>
        </TouchableOpacity>

      </View>
    </GestureHandlerRootView>
  );
}
