
import React, { memo } from 'react';
import { Rect, Circle, Line, Group, Paint, Shadow, Text as SkiaText, Path, Skia, DashPathEffect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { StyleSheet} from 'react-native';

export const NODE_SIZE = 80;
export const MINIMAP_SIZE = 150; // Size of the minimap in pixels
export const WORLD_SIZE = 5000;  // Virtual world size for minimap calculations
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.0;


export const RenderLink = ({ fromId, toId, portFrom, portTo, additionalPort, store }) => {
  const path = useDerivedValue(() => {
    const from = store.value[fromId];
    const to = store.value[toId];
    if (!from || !to) return Skia.Path.Make();

    const x1 = from.x.value + from.outputPorts[portFrom].x;
    const y1 = from.y.value + from.outputPorts[portFrom].y;

    let x2, y2;
    const isAdditional = additionalPort === 1;

    if (isAdditional) {
      const p = to.additionalPorts[portTo];
      if (!p) return Skia.Path.Make();
      x2 = to.x.value + p.x;
      y2 = to.y.value + p.y;
    } else {
      const p = to.inputPorts[portTo];
      if (!p) return Skia.Path.Make();
      x2 = to.x.value + p.x;
      y2 = to.y.value + p.y;
    }

    const newPath = Skia.Path.Make();
    newPath.moveTo(x1, y1);

    const margin = 30;
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;

    // СЛУЧАЙ 1: Нода выше (нужен сложный обход)
    if (y2 < y1 + margin) {
      // Если это доп. порт слева, нам нужно вылететь левее x2 в любом случае
      const minLeftShift = isAdditional ? x2 - margin : x2;
      
      // Вычисляем точку изгиба по горизонтали
      let sideOffset;
      if (deltaX > margin && !isAdditional) {
        sideOffset = x1 + deltaX / 2; // середина, если цель справа
      } else {
        // Если цель слева или это доп. порт, уходим в сторону на minOffset
        const avoidanceWidth = 60 + margin;
        sideOffset = Math.min(x1, x2) - avoidanceWidth;
      }

      newPath.lineTo(x1, y1 + margin);
      newPath.lineTo(sideOffset, y1 + margin);
      
      if (!isAdditional) {
        // Заход в верхний порт
        newPath.lineTo(sideOffset, y2 - margin);
        newPath.lineTo(x2, y2 - margin);
        newPath.lineTo(x2, y2);
      } else {
        // Заход в боковой порт (additional)
        newPath.lineTo(sideOffset, y2);
        newPath.lineTo(x2, y2);
      }
    } 
    // СЛУЧАЙ 2: Нода ниже
    else {
      if (isAdditional) {
        // Плавный обход к боковому порту
        // Делаем S-образный изгиб, который заканчивается горизонтально
        const midX = x1 + (x2 - margin - x1) / 2;
        newPath.cubicTo(
          x1, y1 + deltaY * 0.5, // контроль вниз
          x2 - margin * 2, y2,    // контроль сбоку
          x2, y2                  // точка входа
        );
      } else {
        // Стандартный вход сверху
        const offset = Math.max(deltaY / 2, 20);
        newPath.cubicTo(
          x1, y1 + offset,
          x2, y2 - offset,
          x2, y2
        );
      }
    }

    return newPath;
  });

  return (
    <Path
      path={path}
      style="stroke"
      strokeWidth={2.2}
      color="#6e6e6e"
      strokeCap="round"
      strokeJoin="round"
    />
  );
};

export const RenderTempLine = ({ tempLine, isConnecting }) => {
  const path = useDerivedValue(() => {
    const { x1, y1, x2, y2 } = tempLine.value;

    const newPath = Skia.Path.Make();
    newPath.moveTo(x1, y1);
    const margin = 30;
    const dist = Math.abs(y2 - y1) / 2;
    const offset = Math.max(dist, 30);

    const deltaX = x2 - x1;
    const minOffset = 50 + margin; // Минимальный вылет в сторону
  
    newPath.lineTo(x1, y1 + margin);
    if (y2 < y1) {
      const sideOffset = Math.abs(deltaX) < minOffset 
        ? x1 + (deltaX >= 0 ? minOffset : -minOffset) 
        : x1 + deltaX / 2;
  
      newPath.lineTo(sideOffset, y1 + margin);
      newPath.lineTo(sideOffset, y2 - margin);
      newPath.lineTo(x2, y2 - margin);
      newPath.lineTo(x2, y2);
    } else{
      newPath.cubicTo(
        x1, y1 + offset,
        x2, y2 - offset,
        x2, y2
      );  
    }
    return newPath;
  });

  const opacity = useDerivedValue(() => (isConnecting.value ? 1 : 0));

  return (
    <Path
      path={path}
      color="#727272"
      style="stroke"
      strokeWidth={2}
      opacity={opacity}
      strokeCap="round"
    >
      <DashPathEffect intervals={[10, 5]} />
    </Path>
  );
};

export const MinimapNode = ({ id, store, OFF }) => {
  const nodeData = store.value[id];
  if (!nodeData) return null;
  const transform = useDerivedValue(() => {
    const node = store.value[id];
    if (!node) return [{ translateX: OFF }, { translateY: OFF }];
    

    return [
      { translateX: node.x.value },
      { translateY: node.y.value },
    ];
  });

    return (
      <Group transform={transform}>
        <Rect 
        x={0}
        y={0}
        width={nodeData.width}
        height={nodeData.height}
        color="white"
        />
      </Group>
    );
};

export const MinimapLink = ({ fromId, toId, store }) => {
  const path = useDerivedValue(() => {
    const from = store.value[fromId];
    const to = store.value[toId];
    if (!from || !to) return Skia.Path.Make();

    const newPath = Skia.Path.Make();
    newPath.moveTo(from.x + 50, from.y + 25);
    newPath.lineTo(to.x + 50, to.y + 25);
    return newPath;
  });
  return (
    <Path
      path={path}
      color="cyan"
      style="stroke"
    />
  );
};

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  canvas: { flex: 1 , backgroundColor: 'wite'},
  btn: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, borderWidth: 1, borderColor: '#333' },
  menu: {flexDirection: 'row', position: 'absolute', top: 50, right: 20, zIndex: 100},
  menuBtn: {backgroundColor: '#444', padding: 10, marginLeft: 10, borderRadius: 8, borderWidth: 1, borderColor: 'cyan'},
  menuText: {color: 'cyan', fontWeight: 'bold', fontSize: 12},
  modalOverlay: {backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 1000},
  modal: {backgroundColor: '#222', padding: 25, borderRadius: 20, borderWidth: 1, borderColor: '#444', width: 250},
  modalTitle: {color: 'white', fontSize: 18, textAlign: 'center', marginBottom: 20},
  modalButtons: {flexDirection: 'row', justifyContent: 'space-between'},
  mBtn: {paddingVertical: 10, paddingHorizontal: 30, borderRadius: 10},
  mBtnText: {color: 'white', fontWeight: 'bold'},
  minimapContainer: {position: 'absolute', bottom: 50, right: 20, width: MINIMAP_SIZE, height: MINIMAP_SIZE, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, borderWidth: 1, borderColor: '#555',overflow: 'hidden',}
});