
import React, { memo } from 'react';
import { Rect, Circle, Line, Group, Paint, Shadow, Text as SkiaText, Path, Skia, DashPathEffect } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { StyleSheet} from 'react-native';

export const NODE_SIZE = 80;
const PORT_RADIUS = 6;
const OFF = -10000;
export const MINIMAP_SIZE = 150; // Size of the minimap in pixels
export const WORLD_SIZE = 5000;  // Virtual world size for minimap calculations
export const MIN_SCALE = 0.25;
export const MAX_SCALE = 2.0;

export const RenderLink = ({ fromId, toId, portFrom, portTo, additionalPort, store }) => {
  // Вычисляем путь кривой
  const from = store.value[fromId];
  const to = store.value[toId];
  
  if (!from || !to) return Skia.Path.Make(); // Empty path if threre are no nodes
  
  const path = useDerivedValue(() => {
    const from = store.value[fromId];
    const to = store.value[toId];

    if (!from || !to) return Skia.Path.Make(); // Empty path if threre are no nodes

    const x1 = from.x.value + from.outputPorts[portFrom].x;
    const y1 = from.y.value + from.outputPorts[portFrom].y;
    const x2 = to.x.value + to.inputPorts[portTo].x;
    const y2 = to.y.value + to.inputPorts[portTo].y;
    // if (additionalPort !== 0){
    //   x2 = to.x + to.additionalPorts[portTo].x;
    //   y2 = to.y + to.additionalPorts[portTo].y;
    // }


    // const x1 = from.x + NODE_SIZE / 2;
    // const y1 = from.y + NODE_SIZE; // Exit from below
    // const x2 = to.x + NODE_SIZE / 2;
    // const y2 = to.y; // Entrance from above

    // Vertical distance between nodes for bending calculation
    const verticalDistance = Math.abs(y2 - y1);
    const curveOffset = Math.max(verticalDistance / 2, 20); 

    const newPath = Skia.Path.Make();
    // Moves the pen to the start point
    newPath.moveTo(x1, y1);
    
    // Cubic Bezier curve: Draws a cubic Bezier curve from the current pen position to the specified end point, by using two control points
    // c1x, c1y (checkpoint 1, pull the corve down from the port), c2x, c2y (checkpoint 2, brings the curve up to the finger), x2, y2 (finish)
    // start → cp1 → cp2 → end
    newPath.cubicTo(
      x1, y1 + curveOffset, // Pull down from the first node
      x2, y2 - curveOffset, // Pull up to the second node
      x2, y2
    );

    return newPath;
  });

  const opacity = useDerivedValue(() => 
    (store.value[fromId] && store.value[toId]) ? 1 : 0
  );

  return (
    <Path
      path={path}
      color="cyan"
      style="stroke"
      strokeWidth={2}
      opacity={opacity}
    />
  );
};

export const RenderTempLine = ({ tempLine, isConnecting }) => {
  const path = useDerivedValue(() => {
    const { x1, y1, x2, y2 } = tempLine.value;
    
    const newPath = Skia.Path.Make();
    newPath.moveTo(x1, y1);

    const dist = Math.abs(y2 - y1) / 2;
    const offset = Math.max(dist, 20);

    newPath.cubicTo(
      x1, y1 + offset,
      x2, y2 - offset,
      x2, y2
    );

    return newPath;
  });

  const opacity = useDerivedValue(() => (isConnecting.value ? 1 : 0));

  return (
    <Path
      path={path}
      color="cyan"
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
    const x = useDerivedValue(() => {
      const n = store.value[id];
      return n ? n.x : OFF;
    });
    const y = useDerivedValue(() => {
      const n = store.value[id];
      return n ? n.y : OFF;
    });
    return (
      <Rect 
      x={x} 
      y={y} 
      width={100} 
      height={100} 
      color="#858585c5"
      />
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