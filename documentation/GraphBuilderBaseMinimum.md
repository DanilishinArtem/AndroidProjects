# GraphBuilder
## Introduction
`Libraries`:
- Nativewind: Tailwind CSS for React Native
- react-native-reanimated: High-performance animation system (UI thread → UI thread)
- react-native-gesture-handler: Normal sign language system
- react-native-skia: Canvas / GPU rendering

Common architecture of the constructor of graphs
Almost everytime graph separated to 4 layers:
```
┌─────────────────────────────┐
│ UI / Overlay                │  ← кнопки, меню добавления нод
├─────────────────────────────┤
│ Nodes layer                 │  ← ноды (React View)
├─────────────────────────────┤
│ Edges layer (Skia Canvas)   │  ← линии между нодами
├─────────────────────────────┤
│ Gesture / Camera layer      │  ← pan, zoom, drag
└─────────────────────────────┘
```
<div align="center">

|Feature|Why it works|
|---|---|
|Zoom|Camera zoom|
|Pan|Shift of the camera|
|Lines|Skia render|
|Drag Nodes|Local transforms|
|1000+ Nodes|Skia has no lags|
|Snapping|Coordinates placed in the world space|

</div>
<div align="center">
Table 1. Why using upper libraries is better way of realization 
</div>

For graph-redactor we need two levels of matrices:
```
Camera (world)
 └── Node (local)
      └── Ports
```
Camera:
```js
cameraMatrix (shared)
```
Node
```js
node.position = {x, y}
```
Final transformation of the Node
```js
M_final = CameraMatrix x NodeLocalMatrix
```
## One node realization
### DraggableNode.js (Realization of the draggable node)
```js
import { Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

export function DraggableNode() {
  // sharedValue → a special Reanimated object that can be modified in worklets on the UI thread, without overloading JS
  const x = useSharedValue(100);
  const y = useSharedValue(150);
  // startX and startY — remember the position at the start of the gesture
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // Gesture.Pan() — creating a panning (drag) handler
  const pan = Gesture.Pan()
    // Fires once when the user touches the node
    .onBegin(() => {
      // copy the current node coordinates to startX / startY
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      // Called on each gesture frame
      // e.translationX / e.translationY — finger offset from the start of the gesture
      // Add to startX/startY → get the new node position in world space
      // new_position = position_at_start_of_gesture + finger offset
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    });
  // useAnimatedStyle creates a reactive style that subscribes to shared values.
  // When x.value or y.value changes (in onUpdate), Reanimated automatically updates the style on the UI thread, without a JavaScript bridge.
  const animatedStyle = useAnimatedStyle(() => ({
    // transform: [{ translateX }, { translateY }] — moves the node around the screen.
    transform: [
      { translateX: x.value },
      { translateY: y.value },
    ],
  }));

  return (
    // GestureDetector: Wraps the node and connects it to the pan gesture we created above.
    // Everything inside the GestureDetector will respond to the drag.
    <GestureDetector gesture={pan}>
      {/* Animated.View: This is a regular View, but it's connected to Reanimated. */}
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 120,
            height: 60,
            backgroundColor: "#404040",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          },
          animatedStyle,
        ]}
      >
        <Text style={{ color: "white", fontSize: 16 }}>Node</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```
### App.js
```js
import "react-native-gesture-handler";
import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DraggableNode } from "./src/components/nodes/DraggableNode";

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);

  const addNode = () => {
    const id = Date.now().toString();
    setNodes(prev => [...prev, { id, x: 150, y: 300 }]);
    setMenuVisible(false);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#ffffffff" }}>
      {/* Nodes */}
      {nodes.map((n) => (
        <DraggableNode
          key={n.id}
          initialX={n.x}
          initialY={n.y}
        />
      ))}

      {/* Floating Menu Button */}
      <TouchableOpacity
        style={{
          position: "absolute",
          bottom: 30,
          right: 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: "#888",
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={() => setMenuVisible(prev => !prev)}
      >
        <Text style={{ color: "white", fontSize: 18 }}>≡</Text>
      </TouchableOpacity>

      {/* Hidden Menu */}
      {menuVisible && (
        <View
          style={{
            position: "absolute",
            bottom: 100,
            right: 30,
            width: 120,
            backgroundColor: "#333",
            borderRadius: 12,
            padding: 8,
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 4,
          }}
        >
          <TouchableOpacity
            style={{
              paddingVertical: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={addNode}
          >
            <Text style={{ color: "white" }}>Add Node</Text>
          </TouchableOpacity>
        </View>
      )}
    </GestureHandlerRootView>
  );
}
```
### Architecture of context menu of the node
- App.js stores:
  - List of nodes
  - ID of the node for which the menu is opened
  - Draws the menu once, at the bottom
- DraggableNode.js handles:
  - Pan (grad)
  - LongPress (hold)
  - On longPress $\rightarrow$ calls the on LongPress(id) callback

`New DraggableNode.js`
```js
import { Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";

export function DraggableNode({
  id,
  initialX,
  initialY,
  onLongPress,
}) {
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);

  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // --- DRAG ---
  const pan = Gesture.Pan()
    .onBegin(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = startX.value + e.translationX;
      y.value = startY.value + e.translationY;
    });

  // --- LONG PRESS ---
  const longPress = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      // передаём id и текущие координаты ноды
      runOnJS(onLongPress)(id, x.value, y.value);
    });

  const gesture = Gesture.Simultaneous(pan, longPress);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 120,
            height: 60,
            backgroundColor: "#404040",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          },
          animatedStyle,
        ]}
      >
        <Text style={{ color: "white", fontSize: 16 }}>Node</Text>
      </Animated.View>
    </GestureDetector>
  );
}
```

`New App.js`
```js
import "react-native-gesture-handler";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { DraggableNode } from "./src/components/nodes/DraggableNode";

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const addNode = () => {
    const id = Date.now().toString();
    setNodes(prev => [...prev, { id, x: 150, y: 300 }]);
    setMenuVisible(false);
  };

  // canvasTap для всего канваса
  const canvasTap = Gesture.Tap().onStart(() => {
    if (contextMenu) {
      runOnJS(setContextMenu)(null);
    }
  });

  // canvasTap для использования в Exclusive с меню
  const canvasTapForMenu = Gesture.Tap().onStart(() => {
    if (contextMenu) {
      runOnJS(setContextMenu)(null);
    }
  });

  const menuTap = Gesture.Tap(); // просто поглощаем tap на меню

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <GestureDetector gesture={canvasTap}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>

          {/* Ноды */}
          {nodes.map(n => (
            <DraggableNode
              key={n.id}
              id={n.id}
              initialX={n.x}
              initialY={n.y}
              onLongPress={(id, x, y) =>
                setContextMenu({ id, x, y })
              }
            />
          ))}

          {/* Кнопка добавления */}
          <TouchableOpacity
            style={styles.menuButtonStyle}
            onPress={() => setMenuVisible(p => !p)}
          >
            <Text style={{ color: "white", fontSize: 18 }}>≡</Text>
          </TouchableOpacity>

          {/* Контекстное меню */}
          {contextMenu && (
            <GestureDetector gesture={Gesture.Exclusive(menuTap, canvasTapForMenu)}>
              <View
                style={[
                  styles.contextMenuStyle,
                  {
                    left: contextMenu.x,
                    top: contextMenu.y + 68,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    setNodes(prev =>
                      prev.filter(n => n.id !== contextMenu.id)
                    );
                    setContextMenu(null);
                  }}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: "red" }}>Remove</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    console.log("Open", contextMenu.id);
                    setContextMenu(null);
                  }}
                  style={{ paddingVertical: 6 }}
                >
                  <Text style={{ color: "white" }}>Open</Text>
                </TouchableOpacity>
              </View>
            </GestureDetector>
          )}

          {/* Меню добавления ноды */}
          {menuVisible && (
            <View style={styles.floatingMenuStyle}>
              <TouchableOpacity onPress={addNode}>
                <Text style={{ color: "white" }}>Add Node</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  menuButtonStyle: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#888",
    alignItems: "center",
    justifyContent: "center",
  },
  contextMenuStyle: {
    position: "absolute",
    width: 120,
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
  },
  floatingMenuStyle: {
    position: "absolute",
    bottom: 100,
    right: 30,
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 12,
  },
});
```

## Multy Node Realization
- Camera / World transform = a matrix that can be shifted and scaled
- Node = local position (x, y) relative to the world
- When rendering, final transform = camera × node
```
World Space (Camera)  <- camera matrix
   └── Nodes (each with own local position)
```

