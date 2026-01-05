import React, { memo } from 'react';
import { Rect, Circle, Line, Group, Paint, Shadow, Text as SkiaText} from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { StyleSheet} from 'react-native';

const NODE_SIZE = 80;
const PORT_RADIUS = 6;

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
  const x = useDerivedValue(() => store.value[id]?.x ?? 0);
  const y = useDerivedValue(() => store.value[id]?.y ?? 0);
  const graphId = useDerivedValue(() => store.value[id]?.graphId ?? '');
  const strokeColor = useDerivedValue(() => (store.value[id]?.isActive ? "red" : "transparent"));

  return (
    <Group>
      <Rect x={x} y={y} width={NODE_SIZE} height={NODE_SIZE} color="#333" r={12}>
        <Paint style="stroke" strokeWidth={3} color={strokeColor} />
      </Rect>
      <Group color="white">
        <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 20)} text={`ID: ${id.slice(-4)}`} />
        <SkiaText font={font} x={useDerivedValue(() => x.value + 8)} y={useDerivedValue(() => y.value + 35)} text={useDerivedValue(() => `G_ID: ${graphId.value.slice(-4)}`)} />
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
  const p1 = useDerivedValue(() => ({ 
    x: (store.value[fromId]?.x ?? 0) + NODE_SIZE / 2, 
    y: (store.value[fromId]?.y ?? 0) + NODE_SIZE 
  }));
  const p2 = useDerivedValue(() => ({ 
    x: (store.value[toId]?.x ?? 0) + NODE_SIZE / 2, 
    y: (store.value[toId]?.y ?? 0) 
  }));
  return <Line p1={p1} p2={p2} color="cyan" strokeWidth={2} />;
};

export const RenderTempLine = ({ tempLine, isConnecting }) => {
  const p1 = useDerivedValue(() => ({ x: tempLine.value.x1, y: tempLine.value.y1 }));
  const p2 = useDerivedValue(() => ({ x: tempLine.value.x2, y: tempLine.value.y2 }));
  // opacity is the alpha channel, range:
  // 0 → completely transparent
  // 1 → completely visible
  const opacity = useDerivedValue(() => isConnecting.value ? 1 : 0);
  return <Line p1={p1} p2={p2} color="white" strokeWidth={2} opacity={opacity} strokeCap="round" />;
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
});