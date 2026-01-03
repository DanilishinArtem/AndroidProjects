# Skia library documentation
## Common architecture
React Native Skia — is: 
- A declarative wrapper over th Skia Graphics Engine (the same library used in Chrome, Flutter, Android)
- Rendering bypasses Yoga/Layout/View
- Rendering directly to the GPU (very fast)
```
React
  ↓
JS → JSI → Skia
  ↓
GPU (через Metal / Vulkan / OpenGL)
```
## Example 1 (one rectangle)
### DraggableNode.js
```java
import React from "react";
import { View } from "react-native";
import { Canvas, Rect, Fill } from "@shopify/react-native-skia";

export default function SkiaInterface() {
  return (
    // View: is a regular React Native View. It participates in the React Native layout system.
    // It determines the dimensions for the Canvas. Skia doesn't do layout, it just draws. 
    // Therefor, the Canvas must be wrapped in a View. <View style={{ flex: 1 }}> -> Fill the screen.
    <View style={{flex: 1}}>
        // Canvas: the entry point to Skia, a GPU surface, analogous to <Canvas> in the browser.
        // RN creates a native surface, Skia receives a frawing context. 
        // All child elements become drawing instructions. 
        // Evarything inside <Canvas> is NOT layout components, but graphic primitives.
      <Canvas style={{flex: 1}}>
        // Fill: the command to fill the entire Canvas. Fill redraws the entire Canvas. 
        // Usually sued as a background.
        <Fill color="white" />
        // Rect: the primitive. Draws a rectangle. Sent directly to the GPU.
        <Rect
          x={50}
          y={50}
          width={100}
          height={100}
          color="cyan"
        />
      </Canvas>
    </View>
  )
}
``` 

### App.js
```js
import React from 'react';
import { StyleSheet, SafeAreaView } from 'react-native';
import SkiaInterface from './src/components/nodes/DraggableNode'; 

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <SkiaInterface />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

## Example 2. (Animation)
```java
import React from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Rect, Fill } from "@shopify/react-native-skia";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
// Animated — default: export function default Animated() {}
// useSharedValue — named: export function useSharedValue() {}
import Animated, { useSharedValue, useDerivedValue} from "react-native-reanimated";

export default function DraggableSquare() {
  const SIZE = 100;
  const translateX = useSharedValue(100);
  const translateY = useSharedValue(100);
  const context = useSharedValue({x: 0, y: 0});
  const isActive = useSharedValue(false);

  const panGesture = Gesture.Pan()
    // .value: is used when you READ, WRITE a value in JS/worklet code
    // .value: is NOT used when you PASS a SharedValue to a Skia/Animated component  
    .onBegin((event) => {
      const hitTest = event.x > translateX.value && event.x < translateX.value + SIZE && event.y > translateY.value && event.y < translateY.value + SIZE;
      if (hitTest) {
        isActive.value = true;
        context.value = {x: translateX.value, y: translateY.value};
      }
    })
    .onUpdate((event) => {
      if (isActive.value) {
        translateX.value = context.value.x + event.translationX;
        translateY.value = context.value.y + event.translationY;        
      }
    })
    .onFinalize(() => {
      isActive.value = false;
    });
    // Additional function for collor of frame around a square
    // useDerivedValue: is a computed SharedValue. This is: 
    // 1. it doesn't store its own state.
    // 2. it is calculated from other SharedValue
    // 3. lives on the UI thread
    // 4. automatically updates
    const strokeColor = useDerivedValue(() => {
      return isActive.value ? "white" : "transparent";
    });
    return (
    // Required root for geature-handler
    // Initializes native infrastructure
    // Without it, gestures may not work
      <GestureHandlerRootView style={{flex: 1}}>
        // Signs everything inside the panGesture
        // All taps/movements go to the gesture handler
        <GestureDetector gesture={panGesture}>
          <View style={styles.container}>
            <Canvas style={styles.canvas}>
              <Rect
                x={translateX}
                y={translateY}
                width={SIZE}
                height={SIZE}
                color="red"
              >
                // To draw a frame around a square
                <Paint 
                  style="stroke"
                  strokeWidth={5}
                  color={strokeColor}
                />
              </Rect>
            </Canvas>
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  canvas: { flex: 1, backgroundColor: "#616060ff" },
});
```

## Example 3. (Several objects on the canvas)
