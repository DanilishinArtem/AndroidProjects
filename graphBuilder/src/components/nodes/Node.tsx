import React, { useMemo } from 'react';
import { Group, Rect, Circle, Paint, Text as SkiaText } from '@shopify/react-native-skia';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

const ICONS: Record<string, string> = {
  'flashlight': '\uF244',
  'code': '\uF169',
  'settings': '\uF493',
};

// Константы выносим за пределы компонента
const PORT_RADIUS = 6;
const PORT_SPACING = 20;
const NODE_MIN_WIDTH = 80;
const NODE_MIN_HEIGHT = 80;

export interface NodeData {
  nodeId: string;
  graphId: string;
  label: string;
  color: string;
  inputCount: number;
  outputCount: number;
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: number;  // Предварительно рассчитанная ширина
  height: number; // Предварительно рассчитанная высота
  // Относительные координаты (offset)
  inputPorts: { x: number; y: number }[];
  outputPorts: { x: number; y: number }[];
}

export const createNode = (data: any): NodeData => {
  const w = Math.max(Math.max(data.inputCount, data.outputCount) * PORT_SPACING, NODE_MIN_WIDTH);
  const h = NODE_MIN_HEIGHT;

  // Рассчитываем позиции портов ОДИН раз при создании
  const inputPorts = Array.from({ length: data.inputCount }).map((_, i) => ({
    x: (w / (data.inputCount + 1)) * (i + 1),
    y: 0
  }));

  const outputPorts = Array.from({ length: data.outputCount }).map((_, i) => ({
    x: (w / (data.outputCount + 1)) * (i + 1),
    y: h
  }));

  return { ...data, width: w, height: h, inputPorts: inputPorts, outputPorts: outputPorts };
};

export const NodeView: React.FC<{ node: NodeData; font: any, iconFont: any }> = ({ node, font, iconFont }) => {
  const { x, y, width: w, height: h, inputPorts, outputPorts } = node;
  const transform = useDerivedValue(() => [
    { translateX: x.value },
    { translateY: y.value },
  ]);
  // 1. Оптимизация метрик иконки: считаем один раз при смене иконки/шрифта
  const iconName = ICONS[node.label.toLowerCase()] || ICONS['code'];
  const iconMetrics = useMemo(() => {
    return iconFont ? iconFont.measureText(iconName) : { width: 0, height: 0, x: 0, y: 0 };
  }, [iconFont, iconName]);

  return (
    <Group transform={transform}>
      {/* Тело ноды теперь рисуем в 0,0 */}
      <Rect x={0} y={0} width={w} height={h} r={10} color={node.color}>
        <Paint style="stroke" strokeWidth={2} color="#727272" />
      </Rect>

      {/* Иконка центрируется относительно 0,0 */}
      {iconFont && (
        <SkiaText 
          font={iconFont}
          x={w / 2 - (iconMetrics.x + iconMetrics.width / 2)} 
          y={h / 2 - (iconMetrics.y + iconMetrics.height / 2)} 
          text={iconName}
          color="#000000" 
        />
      )}

      {inputPorts.map((port, i) => (
        <Circle
          key={`in-${i}`}
          cx={port.x}
          cy={port.y}
          r={PORT_RADIUS}
          color="#ffffff"
        >
          <Paint style="stroke" strokeWidth={2} color="#727272" />
        </Circle>
      ))}

      {/* Выходные порты */}
      {outputPorts.map((port, i) => (
        <Circle
          key={`out-${i}`}
          cx={port.x}
          cy={port.y}
          r={PORT_RADIUS}
          color="#ffffff"
        >
          <Paint style="stroke" strokeWidth={2} color="#727272" />
        </Circle>
      ))}
    </Group>
  );
};
