import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Text, useWindowDimensions, NativeModules } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue, makeMutable, clamp, withSpring, useDerivedValue } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MIN_SCALE, MAX_SCALE, NODE_SIZE, MINIMAP_SIZE, WORLD_SIZE, RenderTempLine, RenderLink, styles } from './RenderFunctions';
import { nodeFactory, NodeRenderer } from '../nodes/nodeFactory';
import { Sidebar } from '../interface/sidebar';
import { SelectionRect } from '../interface/areaSelection';
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
  // const startDragOffset = useSharedValue({ x: 0, y: 0 });
  const startDragOffset = useSharedValue<Record<string, { x: number, y: number }>>({});
  const sourcePort = useSharedValue(null);
  const targetPort = useSharedValue(null);
  const additionalPort = useSharedValue(null);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // const selectionRect = useSharedValue({ x1: 0, y1: 0, x2: 0, y2: 0, active: false });
  const selectedNodeIds = useSharedValue([]);
  const linksSV = useSharedValue([]);


  const selectionRect = useSharedValue({
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    active: false,
  });
  const startSelectionRect = useSharedValue<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);

  const selectionDragging = useSharedValue(false);

  useEffect(() => {
    linksSV.value = links;
  }, [links]);

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

  const handleDisconnect = useCallback((targetNodeId, portIndex, portType, currentX, currentY) => {
    // 1. Ищем линк, который входит в нажатый порт
    // targetNodeId — это id ноды (строка или число), portIndex — индекс порта, 
    // portType — 0 для inputPorts, 1 для additionalPorts
    const existingLinkIndex = links.findIndex(link => 
      link.to === targetNodeId && 
      link.portTo === portIndex && 
      link.additionalPort === portType
    );
    if (existingLinkIndex !== -1) {
      const link = links[existingLinkIndex];
      if (!link) return;
      
      // Получаем данные исходной ноды из store (откуда шел линк)
      const sourceNode = nodesStore.value[link.from];
      
      if (sourceNode && sourceNode.outputPorts) {
        const sPort = sourceNode.outputPorts[link.portFrom];
        
        if (sPort) {
          // 2. Настраиваем tempLine для анимации "отрыва"
          // x1, y1 — это координаты выходного порта начальной ноды
          tempLine.value = { 
            x1: sourceNode.x.value + sPort.x, 
            y1: sourceNode.y.value + sPort.y, 
            x2: currentX, 
            y2: currentY 
          };
          
          // 3. Переводим жест в состояние "соединения"
          // Теперь Pan будет думать, что мы тянем линк из исходной ноды
          activeNodeId.value = link.from; 
          sourcePort.value = link.portFrom;
          isConnecting.value = true;

          // 4. Удаляем старый линк из массива
          setLinks(prev => prev.filter((_, i) => i !== existingLinkIndex));
        }
      }
    }
  }, [links, nodesStore, setLinks, activeNodeId, sourcePort, isConnecting, tempLine]);

  const nodeGestures = useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin((e) => {
        isConnecting.value = false;
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;
        const store = nodesStore.value || {};

        // Сбрасываем флаг перетаскивания рамки по умолчанию
        selectionDragging.value = false;

        let hitId = null;

        // 1) сначала пробуем найти конкретную ноду под курсором
        for (let i = nodes.length - 1; i >= 0; i--) {
          const id = nodes[i].id;
          const n = store[id];
          if (!n) continue;
          if (adjX >= n.x.value && adjX <= n.x.value + n.width && adjY >= n.y.value && adjY <= n.y.value + n.height) {
            hitId = id;
            break;
          }
        }

        // 2) если ноду не нашли, но рамка активна, проверяем попадание внутрь рамки — в этом случае запускаем перетаскивание группы
        if (!hitId || selectionRect.value.active) {
          const s = selectionRect.value;
          const minX = Math.min(s.x1, s.x2);
          const maxX = Math.max(s.x1, s.x2);
          const minY = Math.min(s.y1, s.y2);
          const maxY = Math.max(s.y1, s.y2);

          if (adjX >= minX && adjX <= maxX && adjY >= minY && adjY <= maxY) {
            // попали внутрь рамки — считаем, что начали перетаскивать группу
            selectionDragging.value = true;
            // если есть выделенные ноды — Берём первую как ведущую
            hitId = selectedNodeIds.value && selectedNodeIds.value.length ? selectedNodeIds.value[0] : null;
          }
        }

        if (hitId) {
          // Установили активную ноду
          activeNodeId.value = hitId;
          runOnJS(setActiveNodeIdJS)(hitId);

          const n = store[hitId];
          // Проверяем output порты (начало соединения)
          let foundOutput = false;
          for (let p = 0; p < (n.outputPorts?.length || 0); p++) {
            const port = n.outputPorts[p];
            const portX = n.x.value + port.x;
            const portY = n.y.value + port.y;

            const delta = 20;
            const hitbox = adjX > (portX - PORT_RADIUS) && adjX < (portX + PORT_RADIUS) && adjY > (portY - PORT_RADIUS - delta) && adjY < (portY + PORT_RADIUS + delta)
            if(hitbox){
              sourcePort.value = p;
              isConnecting.value = true;
              tempLine.value = { x1: portX, y1: portY, x2: adjX, y2: adjY };
              foundOutput = true;
              break;
            }
          }
          if (foundOutput) return;

          // Проверяем input / additional порты
          const inputGroups = [
            { ports: n.inputPorts || [], type: 0 },
            { ports: n.additionalPorts || [], type: 1 },
          ];

          let foundInput = false;
          for (const group of inputGroups) {
            for (let pi = 0; pi < group.ports.length; pi++) {
              const port = group.ports[pi];
              const portX = n.x.value + port.x;
              const portY = n.y.value + port.y;
              const distSq = (adjX - portX) * (adjX - portX) + (adjY - portY) * (adjY - portY);

              if (distSq <= PORT_RADIUS * PORT_RADIUS) {
                const hasLink = linksSV.value.some(l => l.to === hitId && l.portTo === pi && l.additionalPort === group.type);
                if (hasLink) {
                  runOnJS(handleDisconnect)(hitId, pi, group.type, adjX, adjY);
                  foundInput = true;
                }
                break;
              }
            }
            if (foundInput) break;
          }
          if (foundInput) return;

          // Если схватили ноду, которая НЕ в выделении — сбрасываем выделение
          if (!isConnecting.value) {
            if (!selectedNodeIds.value.includes(hitId) || selectedNodeIds.value.length <= 1) {
              selectedNodeIds.value = [hitId];
              // когда мы нажали конкретную ноду — рамку убираем
              selectionRect.value = { x1: 0, y1: 0, x2: 0, y2: 0, active: false };
            }

            // Запоминаем стартовые позиции всех выделенных нод
            const offsets = {};
            selectedNodeIds.value.forEach(id => {
              if (store[id]) offsets[id] = { x: store[id].x.value, y: store[id].y.value };
            });
            startDragOffset.value = offsets;

            // Если мы начали перетаскивать существующую рамку — запомним её стартовые координаты
            if (selectionDragging.value) {
              startSelectionRect.value = { ...selectionRect.value };
            }
          }
        } else {
          // Ничего не попали — начинаем рисовать рамку выделения
          activeNodeId.value = null;
          selectedNodeIds.value = [];
          selectionRect.value = { x1: adjX, y1: adjY, x2: adjX, y2: adjY, active: true };
          selectionDragging.value = false;
        }
      })
      .onUpdate((e) => {
        runOnJS(setActiveMenu)(null);
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;

        // Если рамка активна и мы НЕ в режиме перетаскивания рамки — обновляем конец рамки (рисуем рамку)
        if (selectionRect.value.active && !selectionDragging.value) {
          selectionRect.value = { ...selectionRect.value, x2: adjX, y2: adjY };
          return;
        }

        // Если тянем линк — обновляем временную линию и не движем ноды
        if (isConnecting.value) {
          tempLine.value = { ...tempLine.value, x2: adjX, y2: adjY };
          return;
        }

        // Перетаскивание группы либо одиночной ноды
        if (activeNodeId.value) {
          const dx = e.translationX / scale.value;
          const dy = e.translationY / scale.value;

          nodesStore.modify(val => {
            'worklet';
            // Двигаем все ноды из selectedNodeIds относительно startDragOffset
            selectedNodeIds.value.forEach(id => {
              const startPos = startDragOffset.value[id];
              if (val[id] && startPos) {
                val[id].x.value = startPos.x + dx;
                val[id].y.value = startPos.y + dy;
              }
            });

            // Если мы перетаскиваем рамку — нужно сдвинуть и координаты рамки относительно её стартового состояния
            if (selectionDragging.value && startSelectionRect.value) {
              const s = startSelectionRect.value;
              selectionRect.value = {
                x1: s.x1 + dx,
                y1: s.y1 + dy,
                x2: s.x2 + dx,
                y2: s.y2 + dy,
                active: true,
              };
            }

            return val;
          });
        }
      })
      .onFinalize((e) => {
        const adjX = (e.x - translateX.value) / scale.value;
        const adjY = (e.y - translateY.value) / scale.value;

        // Если мы рисовали рамку (и не перетаскивали её) — вычисляем попавшие ноды и фиксируем рамку
        if (selectionRect.value.active && !selectionDragging.value) {
          const selX1 = Math.min(selectionRect.value.x1, selectionRect.value.x2);
          const selY1 = Math.min(selectionRect.value.y1, selectionRect.value.y2);
          const selX2 = Math.max(selectionRect.value.x1, selectionRect.value.x2);
          const selY2 = Math.max(selectionRect.value.y1, selectionRect.value.y2);

          const newSelectedIds = [];
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

          for (const id in nodesStore.value) {
            const n = nodesStore.value[id];
            if (n.x.value + n.width >= selX1 && n.x.value <= selX2 && n.y.value + n.height >= selY1 && n.y.value <= selY2) {
              newSelectedIds.push(id);
              minX = Math.min(minX, n.x.value);
              minY = Math.min(minY, n.y.value);
              maxX = Math.max(maxX, n.x.value + n.width);
              maxY = Math.max(maxY, n.y.value + n.height);
            }
          }

          if (newSelectedIds.length > 0) {
            selectedNodeIds.value = newSelectedIds;
            const offset = 15;
            selectionRect.value = {
              x1: minX - offset,
              y1: minY - offset,
              x2: maxX + offset,
              y2: maxY + offset,
              active: true,
            };
          } else {
            selectionRect.value = { x1: 0, y1: 0, x2: 0, y2: 0, active: false };
            selectedNodeIds.value = [];
          }
        }

        // Обработка соединений (если начинали тянуть линию)
        const hasMoved = Math.abs(e.translationX) > 5 || Math.abs(e.translationY) > 5;
        if (isConnecting.value && hasMoved && activeNodeId.value) {
          let targetId = null;
          const store = nodesStore.value || {};

          for (const id in store) {
            const n = store[id];
            if (adjX >= n.x.value - PORT_RADIUS && adjX <= n.x.value + n.width + PORT_RADIUS && adjY >= n.y.value - PORT_RADIUS && adjY <= n.y.value + n.height + PORT_RADIUS) {
              const parts = [n.inputPorts || [], n.additionalPorts || []];
              for (let part = 0; part < parts.length; part++) {
                const ports = parts[part];
                for (let pi = 0; pi < ports.length; pi++) {
                  const port = ports[pi];
                  const portX = n.x.value + port.x;
                  const portY = n.y.value + port.y;
                  const delta = 20;
                  const hitbox = adjX > (portX - PORT_RADIUS) && adjX < (portX + PORT_RADIUS) && adjY > (portY - PORT_RADIUS - delta) && adjY < (portY + PORT_RADIUS + delta)
                  if(hitbox){
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

        // Сбрасываем флаги активности у ноды (если была активна)
        const currentId = activeNodeId.value;
        if (currentId) {
          nodesStore.modify(val => {
            'worklet';
            if (val[currentId]) val[currentId].isActive = 0;
            return val;
          });
        }

        // Сбрасываем режим перетаскивания рамки и временные значения
        selectionDragging.value = false;
        startSelectionRect.value = null;

        activeNodeId.value = null;
        isConnecting.value = false;
        tempLine.value = { x1: 0, y1: 0, x2: 0, y2: 0 };
        runOnJS(setActiveNodeIdJS)(null);
      });

    const tap = Gesture.Tap().onStart((e) => {
      const adjX = (e.x - translateX.value) / scale.value;
      const adjY = (e.y - translateY.value) / scale.value;

      const rect = selectionRect.value || { x1: 0, y1: 0, x2: 0, y2: 0 };
      const minX = Math.min(rect.x1, rect.x2);
      const maxX = Math.max(rect.x1, rect.x2);
      const minY = Math.min(rect.y1, rect.y2);
      const maxY = Math.max(rect.y1, rect.y2);
      const isOutside = adjX < minX || adjX > maxX || adjY < minY || adjY > maxY;

      if (isOutside) {
        selectionRect.value = { x1: 0, y1: 0, x2: 0, y2: 0, active: false };
        selectedNodeIds.value = [];
      }

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
  }, [
    nodes,
    nodesStore,
    translateX,
    translateY,
    scale,
    isConnecting,
    tempLine,
    startDragOffset,
    startSelectionRect,
    selectionDragging,
    selectionRect,
    selectedNodeIds,
    linksSV,
    mergeGraphs,
    handleDisconnect,
    setActiveMenu,
    setActiveNodeIdJS,
  ]);

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

              <SelectionRect selectionSV={selectionRect} />

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