import React, { useState } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RenderMenu, RenderTempLine, RenderLink, RenderNode, styles} from './RenderFunctions';
import { runOnJS } from 'react-native-worklets';
import { useDerivedValue } from 'react-native-reanimated';
const NODE_SIZE = 80;

export default function GraphApp() {
  // This variables for: React render, JSX, text, lists
  // list of nodes for react components: { id, graphId }
  const [nodes, setNodes] = useState([]);
  // list of links
  const [links, setLinks] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  // Single source of truth for coordinates. 
  // Lives on the UI thread, available within worklets (Gesture, useDerivesValue)
  // nodesStore.value = {
    //   n_123: { x: 150, y: 100, graphId: 'g_123', isActive: 0 },
    //   n_456: { x: 300, y: 200, graphId: 'g_123', isActive: 0 },
    // }
    // This variables for: UI thread, Skia, gestures, performance
  const nodesStore = useSharedValue({});
  // Position of the menu
  const menuPos = useSharedValue({ x: 0, y: 0 });
  // Active node, flag of which node is gragging now.
  const activeNodeId = useSharedValue(null);
  // Regime of connecting (fraw temp line if ture)
  const isConnecting = useSharedValue(false);
  // const tempLine = useSharedValue({
  //   x1: 0, y1: 0,
  //   x2: 0, y2: 0
  // });
  const tempLine = useSharedValue({ x1: 0, y1: 0, x2: 0, y2: 0 });
  // Start of offset. To ensure absolute dragging, rather than jumping.
  const startDragOffset = useSharedValue({ x: 0, y: 0 });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const pinchCenter = useSharedValue({ x: 0, y: 0 });
  const isPinching = useSharedValue(false);

  // mergeGraphs: logical union of subgraphs. Called then user has dragged the link to another node.
  const mergeGraphs = (fromId, toId) => {
    // Protection from self-connection
    if (fromId === toId) return;
    // Reconnection protection
    const linkExists = links.some(
      l => (l.from === fromId && l.to === toId) || (l.from === toId && l.to === fromId)
    );
    if (linkExists) return;
    setLinks(prev => [...prev, { from: fromId, to: toId }]);
    
    const targetGraphId = nodesStore.value[toId]?.graphId;
    const sourceGraphId = nodesStore.value[fromId]?.graphId;
    // Protection against: 1. Undefined, 2. connecting a node to itself, 3. repeated merge
    if (!targetGraphId || !sourceGraphId || targetGraphId === sourceGraphId) return;

    nodesStore.modify((val) => {
      'worklet';
      Object.keys(val).forEach(id => {
        // source.graphId = target.graphId (assign ite ID of the target graph to all nodes of the source graph)
        if (val[id].graphId === sourceGraphId) val[id].graphId = targetGraphId;
      });
      return val;
    });
    // Example for map method: [1, 2, 3].map(x => x * 2)
    setNodes(prev => prev.map(n => 
      // If n.graphId === sourceGraphId then return a copy of the object, but with a new graphId
      // otherwise, return the object as is
      n.graphId === sourceGraphId ? { ...n, graphId: targetGraphId } : n
    ));
  };

  const addNewNode = () => {
    const id = `n_${Date.now()}`;
    const graphId = `g_${id}`;
    // Why .modify, 
    // 1. Overwrites the object, 2. Breaks references, 3. Heavier for Reanimated
    // but not nodesStore.value = ...
    // 1. Mutates the object on the UI thread, 2. Fast, 3. Safe
    nodesStore.modify((value) => {
      'worklet'; // THIS FUNCTION IS EXECUTED ON THE UI THREAD
      value[id] = { x: 150, y: 100, graphId, isActive: 0 };
      return value;
    });
    setNodes(prev => [...prev, { id, graphId }]);
  };

  const recalculateGraphIds = (currentNodes, currentLinks) => {
    const visited = new Set();
    const resultNodes = [];
    var counter = 1;
    currentNodes.forEach(startNode => {
      if (!visited.has(startNode.id)) {
        // Found a new connectivity component - generate a unique ID for it
        const newGraphId = `g_n_${Math.round(Date.now() + counter)}`;
        counter = counter + 1;
        // BFS to find all connected nodes
        const queue = [startNode.id];
        visited.add(startNode.id);

        while (queue.length > 0) {
          const nodeId = queue.shift();
          const node = currentNodes.find(n => n.id === nodeId);
          
          if (node) {
            resultNodes.push({ ...node, graphId: newGraphId });
          }

          // We are looking for neighbors through links
          currentLinks.forEach(link => {
            let neighborId = null;
            if (link.from === nodeId) neighborId = link.to;
            if (link.to === nodeId) neighborId = link.from;

            if (neighborId && !visited.has(neighborId)) {
              visited.add(neighborId);
              queue.push(neighborId);
            }
          });
        }
      }
    });

    return resultNodes;
  };

  const deleteNode = () => {
    if (!selectedNodeId) return;

    const idToDelete = selectedNodeId;

    // 1. First, we update the links, removing everything that led to and out of the node being deleted
    const updatedLinks = links.filter(l => l.from !== idToDelete && l.to !== idToDelete);
    
    // 2. Removing the node itself from the React list
    const updatedNodes = nodes.filter(n => n.id !== idToDelete);

    // 3. Recalculate GraphIds for all nodes
    const newNodes = recalculateGraphIds(updatedNodes, updatedLinks);

    // 4. Update nodesStore (UI Thread) for Skia
    nodesStore.modify((val) => {
      'worklet';
      delete val[idToDelete]; // Delete the node
      // Synchronize new graphIds for all other nodes
      newNodes.forEach(node => {
        if (val[node.id]) {
          val[node.id].graphId = node.graphId;
        }
      });
      return val;
    });

    // 5. Update React State
    setLinks(updatedLinks);
    setNodes(newNodes);
    setMenuVisible(false);
    setSelectedNodeId(null);
  };

  const saveGraph = async () => {
    try {
      // Collect data from nodes (structure) and nodesStore (coordinates)
      const dataToSave = {
        nodes: nodes,
        links: links,
        // Extract the current coordinates values from SharedValue
        coords: nodesStore.value 
      };
      // Saving to json (local storage)
      await AsyncStorage.setItem('@my_graph_data', JSON.stringify(dataToSave));
      alert('Graph is saved!');
    } catch (e) {
      console.error("Error saving graph", e);
    }
  };

  const loadGraph = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('@my_graph_data');
      if (jsonValue != null) {
        const savedData = JSON.parse(jsonValue);
        
        // First, we update the heave coordinate storage on the UI thread
        nodesStore.modify((val) => {
          'worklet';
          // Deleting old and writing new datas
          Object.keys(val).forEach(key => delete val[key]);
          Object.assign(val, savedData.coords);
          return val;
        });
        
        // Then we update the React state to render the lists
        setNodes(savedData.nodes);
        setLinks(savedData.links);
        
        alert('Graph is loaded!');
      }
    } catch (e) {
      console.error("Error loading graph", e);
    }
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      const adjX = (e.x - translateX.value) / scale.value;
      const adjY = (e.y - translateY.value) / scale.value;
      if (menuVisible) {
        const mx = menuPos.value.x;
        const my = menuPos.value.y;
        
        // YES button (coordinates relative to the menu)
        if (adjX >= mx + 10 && adjX <= mx + 70 && adjY >= my + 40 && adjY <= my + 70) {
          runOnJS(deleteNode)();
          return;
        }
        // Кнопка NO
        if (adjX >= mx + 80 && adjX <= mx + 140 && adjY >= my + 40 && adjY <= my + 70) {
          runOnJS(setMenuVisible)(false);
          return;
        }
        // If you clicked past the menu, just close it.
        runOnJS(setMenuVisible)(false);
        return;
      }

      const store = nodesStore.value;
      for (const id in store) {
        const n = store[id];
        if (adjX >= n.x && adjX <= n.x + NODE_SIZE && adjY >= n.y && adjY <= n.y + NODE_SIZE) {
          activeNodeId.value = id;
          const isBottomEdge = adjY > n.y + NODE_SIZE - 25;

          if (isBottomEdge) {
            isConnecting.value = true;
            tempLine.value = { x1: n.x + NODE_SIZE / 2, y1: n.y + NODE_SIZE, x2: adjX, y2: adjY };
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
        tempLine.value = { ...tempLine.value, x2: adjX, y2: adjY };
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
          if (id !== activeNodeId.value && adjX >= n.x && adjX <= n.x + NODE_SIZE && adjY >= n.y && adjY <= n.y + NODE_SIZE) {
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

  const longPress = Gesture.LongPress()
    .onStart((e) => {
      const adjX = (e.x - translateX.value) / scale.value;
      const adjY = (e.y - translateY.value) / scale.value;
      const store = nodesStore.value;
      for (const id in store) {
        const n = store[id];
        if (adjX >= n.x && adjX <= n.x + NODE_SIZE && adjY >= n.y && adjY <= n.y + NODE_SIZE) {
          // Remember where to draw the menu
          menuPos.value = { x: adjX, y: adjY };
          runOnJS(setSelectedNodeId)(id);
          runOnJS(setMenuVisible)(true);
          break;
        }
      }
    });
  
  const canvasPan = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      if (isPinching.value || activeNodeId.value !== null) return;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (isPinching.value || activeNodeId.value !== null) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const canvasPinch = Gesture.Pinch()
    .onStart((e) => {
      isPinching.value = true;
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      // Fix the center at the start in canvas coordinates
      // screenX = translateX + canvasX * scalescreenX
      // And as e.focal is in screen coordinates: canvasX = (screenX - translateX) / scale, and same for Y
      pinchCenter.value = {
        x: (e.focalX - translateX.value) / scale.value,
        y: (e.focalY - translateY.value) / scale.value
      };
    })
    .onUpdate((e) => {
      const nextScale = savedScale.value * e.scale;

      // Recalculation translate relative to a fixed center
      // Screen = translateOld + pinchCenter * scaleOld = translateNew + pinchCenter * scaleNew
      // translateNew = translateOld - pinchCenter * (scaleNew - scaleOld)
      translateX.value = savedTranslateX.value - pinchCenter.value.x * (nextScale - savedScale.value);
      translateY.value = savedTranslateY.value - pinchCenter.value.y * (nextScale - savedScale.value);

      scale.value = nextScale;
    })
    .onEnd(() => {
      isPinching.value = false;
    });

  const canvasGesture = Gesture.Simultaneous(canvasPan, canvasPinch);
  // Gesture.Simultaneous(pan, longPress): is a parallel operation. 
  // Both gestures can be active at the same time. We don't need this, so we use Race.
  const nodeGestures = Gesture.Race(pan, longPress);
  // Final composition:
  // Simultaneous allows the background to scale even if one finger is on a node
  const composedGesture = Gesture.Simultaneous(nodeGestures, canvasGesture);
  // const composedGesture = Gesture.Simultaneous(canvasGesture);
  const font = useFont(require('../../../assets/fonts/Roboto_Condensed-BlackItalic.ttf'), 11);
  const sceneTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);
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
              {/* array.map((element, index) => { */}
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
              <RenderMenu 
                visible={menuVisible} 
                pos={menuPos} 
                font={font} 
                nodeId={selectedNodeId} 
              />
            </Group>
          </Canvas>
        </GestureDetector>
        <TouchableOpacity style={styles.btn} onPress={addNewNode}>
          <Text style={{color:'#fff', fontWeight:'bold'}}>+ ADD NODE</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}