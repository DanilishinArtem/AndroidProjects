
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

export const RenderMenu = ({ visible, pos, font, nodeId }) => {
  const transform = useDerivedValue(() => [
    { translateX: pos.value.x },
    { translateY: pos.value.y },
    { scale: visible ? 1 : 0 },
  ]);

  return (
    <Group transform={transform}>
      {/* Background of the menu */}
      <Rect x={0} y={0} width={150} height={80} color="#222" r={10}>
        <Shadow dx={0} dy={4} blur={10} color="rgba(0,0,0,0.5)" />
        <Paint style="stroke" strokeWidth={1} color="#444" />
      </Rect>

      {/* Title */}
      <SkiaText 
        font={font} 
        x={10} y={25} 
        text={`Delete node ${nodeId?.slice(-4)}?`} 
        color="white" 
      />

      {/* Button YES */}
      <Group>
        <Rect x={10} y={40} width={60} height={30} color="#e74c3c" r={5} />
        <SkiaText font={font} x={25} y={60} text="YES" color="white" />
      </Group>

      {/* Button NO */}
      <Group>
        <Rect x={80} y={40} width={60} height={30} color="#444" r={5} />
        <SkiaText font={font} x={95} y={60} text="NO" color="white" />
      </Group>
    </Group>
  );
};

export const RenderNode = ({ id, store, font, incoming, outgoing }) => {
  const x = useDerivedValue(() => {
    const n = store.value[id];
    return n ? n.x : OFF;
  });

  const y = useDerivedValue(() => {
    const n = store.value[id];
    return n ? n.y : OFF;
  });

  const graphId = useDerivedValue(() => store.value[id]?.graphId ?? '');
  const strokeColor = useDerivedValue(() =>
    store.value[id]?.isActive ? 'red' : 'transparent'
  );
  return (
    <Group>
      <Rect x={x} y={y} width={NODE_SIZE} height={NODE_SIZE} color="#333" r={12}>
        <Paint style="stroke" strokeWidth={3} color={strokeColor} />
      </Rect>
      <Group color="white">
        <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 20)} text={`${store.value[id].type}`} />
        <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 35)} text={`Id: ${id.slice(-4)}`} />
        <Group color="#aaa">
            <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 55)} text={`In: ${incoming || 'none'}`} />
            <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 70)} text={`Out: ${outgoing || 'none'}`} />
        </Group>
      </Group>
      <Circle cx={useDerivedValue(() => x.value + NODE_SIZE / 2)} cy={y} r={PORT_RADIUS} color="#555">
        <Paint style="stroke" strokeWidth={1} color="cyan" />
      </Circle>
      <Circle cx={useDerivedValue(() => x.value + NODE_SIZE / 2)} cy={useDerivedValue(() => y.value + NODE_SIZE)} r={PORT_RADIUS} color="cyan" />
    </Group>
  );
};

export const RenderLink = ({ fromId, toId, store }) => {
  // Вычисляем путь кривой
  const path = useDerivedValue(() => {
    const from = store.value[fromId];
    const to = store.value[toId];

    if (!from || !to) return Skia.Path.Make(); // Empty path if threre are no nodes

    const x1 = from.x + NODE_SIZE / 2;
    const y1 = from.y + NODE_SIZE; // Exit from below
    const x2 = to.x + NODE_SIZE / 2;
    const y2 = to.y; // Entrance from above

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
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  canvas: { flex: 1 },
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
