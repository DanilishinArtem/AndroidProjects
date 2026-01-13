import React, { useState, useMemo, useCallback } from 'react';
import { View, TouchableOpacity, Text, useWindowDimensions, NativeModules } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, makeMutable, clamp, withSpring, useDerivedValue } from 'react-native-reanimated';
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

const { GraphEngine } = NativeModules;

export default function GraphApp() {
  const MINIMAP_RATIO = MINIMAP_SIZE / WORLD_SIZE;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeNodeIdJS, setActiveNodeIdJS] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const nodesStore = useSharedValue({});
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

  const makeLinkId = useCallback((from, to, portFrom, portTo, addPort) => `${from}__${to}__${portFrom}__${portTo}__${addPort}__${Date.now()}`, []);

  const mergeGraphs = useCallback((fromId, toId, portFrom, portTo, addPort) => {
    setLinks(prev => {
      const exists = prev.some(l =>
        l.from === fromId &&
        l.to === toId &&
        l.portFrom === portFrom &&
        l.portTo === portTo &&
        l.additionalPort === addPort
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          id: makeLinkId(fromId, toId, portFrom, portTo, addPort),
          from: fromId,
          to: toId,
          portFrom,
          portTo,
          additionalPort: addPort,
        },
      ];
    });

    const targetGraphId = nodesStore.value?.[toId]?.graphId;
    const sourceGraphId = nodesStore.value?.[fromId]?.graphId;
    if (!targetGraphId || !sourceGraphId) return;

    nodesStore.modify(val => {
      'worklet';
      for (const id in val) {
        if (val[id].graphId === sourceGraphId) val[id].graphId = targetGraphId;
      }
      return val;
    });

    setNodes(prev => prev.map(n => (n.graphId === sourceGraphId ? { ...n, graphId: targetGraphId } : n)));
  }, [nodesStore, makeLinkId]);

  const addNodeOfType = useCallback((type) => {
    const id = `n_${Date.now()}`;
    const graphId = `g_${id}`;
    const initX = (screenWidth / 4 - translateX.value) / scale.value;
    const initY = (screenHeight / 4 - translateY.value) / scale.value;
    const xSV = makeMutable(initX);
    const ySV = makeMutable(initY);
    const node = nodeFactory(type, id, graphId, xSV, ySV);

    nodesStore.modify(val => {
      'worklet';
      val[id] = node;
      return val;
    });

    setNodes(prev => [...prev, { id, graphId, type }]);
    setSidebarOpen(false);
  }, [screenWidth, screenHeight, nodesStore, translateX, translateY, scale]);

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
      const newGraphId = `g_n_${Date.now()}_${counter++}`;
      const queue = [sid];
      visited.add(sid);

      while (queue.length) {
        const nid = queue.shift();
        const node = nodeMap.get(nid);
        if (node) result.push({ ...node, graphId: newGraphId });
        const neighbors = adj.get(nid) || [];
        for (const nb of neighbors) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
    }

    for (const n of currentNodes) {
      if (!result.find(r => r.id === n.id)) result.push({ ...n, graphId: `g_n_${Date.now()}_${counter++}` });
    }

    return result;
  }, []);

  const deleteNode = useCallback((nodeId) => {
    const updatedLinks = links.filter(l => l.from !== nodeId && l.to !== nodeId);
    const updatedNodes = nodes.filter(n => n.id !== nodeId);
    const newNodes = recalculateGraphIds(updatedNodes, updatedLinks);

    nodesStore.modify(val => {
      'worklet';
      if (val[nodeId]) delete val[nodeId];
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
        const store = nodesStore.value || {};
        for (let i = nodes.length - 1; i >= 0; i--) {
          const id = nodes[i].id;
          const n = store[id];
          if (!n) continue;
          if (adjX >= n.x.value - PORT_RADIUS && adjX <= n.x.value + n.width + PORT_RADIUS &&
              adjY >= n.y.value - PORT_RADIUS && adjY <= n.y.value + n.height + PORT_RADIUS) {
            activeNodeId.value = id;
            runOnJS(setActiveNodeIdJS)(id);

            for (let p = 0; p < (n.outputPorts?.length || 0); p++) {
              const port = n.outputPorts[p];
              const portX = n.x.value + port.x;
              const portY = n.y.value + port.y;
              const distSq = (adjX - portX) * (adjX - portX) + (adjY - portY) * (adjY - portY);
              if (distSq <= PORT_RADIUS * PORT_RADIUS) {
                sourcePort.value = p;
                isConnecting.value = true;
                tempLine.value = { x1: portX, y1: portY, x2: adjX, y2: adjY };
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
          tempLine.value = { ...tempLine.value, x2: adjX, y2: adjY };
        } else {
          nodesStore.modify(val => {
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
          const store = nodesStore.value || {};
          for (const id in store) {
            const n = store[id];
            if (adjX >= n.x.value - PORT_RADIUS && adjX <= n.x.value + n.width + PORT_RADIUS &&
                adjY >= n.y.value - PORT_RADIUS && adjY <= n.y.value + n.height + PORT_RADIUS) {
              const parts = [n.inputPorts || [], n.additionalPorts || []];
              for (let part = 0; part < parts.length; part++) {
                const ports = parts[part];
                for (let pi = 0; pi < ports.length; pi++) {
                  const port = ports[pi];
                  const portX = n.x.value + port.x;
                  const portY = n.y.value + port.y;
                  const distSq = (adjX - portX) * (adjX - portX) + (adjY - portY) * (adjY - portY);
                  if (distSq <= PORT_RADIUS * PORT_RADIUS) {
                    targetPort.value = pi;
                    additionalPort.value = part;
                    targetId = id;
                    break;
                  }
                }
                if (targetId) break;
              }
              if (targetId) break;
            }
          }
          if (targetId) runOnJS(mergeGraphs)(activeNodeId.value, targetId, sourcePort.value, targetPort.value, additionalPort.value);
        }

        nodesStore.modify(val => {
          'worklet';
          if (activeNodeId.value && val[activeNodeId.value]) val[activeNodeId.value].isActive = 0;
          return val;
        });

        activeNodeId.value = null;
        runOnJS(setActiveNodeIdJS)(null);
        isConnecting.value = false;
      });

    const tap = Gesture.Tap()
      .onStart((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        let found = null;
        const store = nodesStore.value || {};
        for (const id in store) {
          const n = store[id];
          if (adjX >= n.x.value && adjX <= n.x.value + n.width && adjY >= n.y.value && adjY <= n.y.value + n.height) {
            found = { nodeId: n.nodeId, x: n.x.value, y: n.y.value, width: n.width, height: n.height };
            break;
          }
        }
        runOnJS(setActiveMenu)(found);
      });

    return Gesture.Race(pan, tap);
  }, [nodes, nodesStore, translateX, translateY, scale, isConnecting, tempLine, startDragOffset, mergeGraphs]);

  const handleMenuAction = useCallback((action) => {
    if (action === 'delete' && activeMenu) {
      deleteNode(activeMenu.nodeId);
    }
    runOnJS(setActiveMenu)(null);
  }, [activeMenu, deleteNode]);

  const sceneTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  const font = useFont(require('../../../assets/fonts/Roboto_Condensed-BlackItalic.ttf'), 14);
  const iconFont = useFont(require("../../../assets/fonts/MaterialCommunityIcons.ttf"), 25);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>

        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onAddNode={(type) => addNodeOfType(type)} />

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

              {nodes.map(n => n.id === activeNodeIdJS ? null : (
                <NodeRenderer key={n.id} id={n.id} store={nodesStore} font={font} iconFont={iconFont} />
              ))}

              {activeNodeIdJS && (
                <NodeRenderer key={`active-${activeNodeIdJS}`} id={activeNodeIdJS} store={nodesStore} font={font} iconFont={iconFont} />
              )}

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
