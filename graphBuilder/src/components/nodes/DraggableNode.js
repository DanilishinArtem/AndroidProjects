import React from "react";
import { StyleSheet, View } from "react-native";
import { Canvas, Rect, Paint, Fill } from "@shopify/react-native-skia";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useDerivedValue} from "react-native-reanimated";

export default function DraggableNode( initialX, initialY, color ) {
  const SIZE = 100;
  const translateX = useSharedValue(initialX);
  const translateY = useSharedValue(initialY);
  const context = useSharedValue({x: 0, y: 0});
  const isActive = useSharedValue(false);

  const panGesture = Gesture.Pan()
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

    const strokeColor = useDerivedValue(() => {
      return isActive.value ? "white" : "transparent";
    });
    return (
      <GestureDetector gesture={panGesture}>
        {/* 
          ВАЖНО: В Skia мы не можем вернуть GestureDetector внутри Canvas.
          Поэтому GestureDetector должен оборачивать весь Canvas, либо мы используем
          хитрый прием с прозрачными слоями. 
          Но для простоты в Skia чаще всего делают ОДИН GestureDetector на весь Canvas.
        */}
        <Rect x={translateX} y={translateY} width={SIZE} height={SIZE} color={color}>
          <Paint style="stroke" strokeWidth={3} color={strokeColor} />
        </Rect>
      </GestureDetector>
    )
}