import { createNode, NodeData, NodeView } from './Node'
import { SharedValue } from 'react-native-reanimated';


// Типы нод, которые есть в твоем приложении
export type NodeType = 'Code' | 'Filter' | 'Merge' | 'FlashLight' | 'Vibration' | 'Webhook' | 'Schedule' | 'On App Event' | 'AI Agent' | 'OpenAI' | 'Document Loader';

interface NodeDefinition {
  label: string;
  color: string;
  inputCount: number;
  outputCount: number;
  additionalCount: number;
}

// Реестр настроек нод
const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
    'Code': {label: 'code', color: '#ffffff', inputCount: 1, outputCount: 1, additionalCount: 0},
    'Filter': {label: 'filter', color: '#ffffff', inputCount: 1, outputCount: 1, additionalCount: 0},
    'Merge': {label: 'merge', color: '#ffffff', inputCount: 2, outputCount: 1, additionalCount: 0},
    'FlashLight': {label: 'flashlight', color: '#ffffff', inputCount: 1, outputCount: 1, additionalCount: 0},
    'Vibration': {label: 'vibration', color: '#ffffff', inputCount: 1, outputCount: 1, additionalCount: 0},
    'Webhook': {label: 'webhook', color: '#ffffff', inputCount: 0, outputCount: 1, additionalCount: 0},
    'Schedule': {label: 'schedule', color: '#ffffff', inputCount: 0, outputCount: 1, additionalCount: 0},
    'On App Event': {label: 'on_app_event', color: '#ffffff', inputCount: 0, outputCount: 1, additionalCount: 0},
    'AI Agent': {label: 'ai_agent', color: '#ffffff', inputCount: 1, outputCount: 1, additionalCount: 3},
    'OpenAI': {label: 'openAI', color: '#ffffff', inputCount: 1, outputCount: 1, additionalCount: 1},
    'Document Loader': {label: 'document_loader', color: '#ffffff', inputCount: 0, outputCount: 1, additionalCount: 0},
};

export const nodeFactory = (
    type: NodeType,
    nodeId: string,
    graphId: string,
    x: SharedValue<number>,
    y: SharedValue<number>
  ): NodeData => {
    const def = NODE_DEFINITIONS[type];

    // Вызываем твою функцию createNode, передавая параметры из реестра
    return createNode({
      nodeId,
      graphId,
      desc: type,
      label: def.label.trim().toLowerCase().replace(/\s+/g, '_'),
      color: def.color,
      inputCount: def.inputCount,
      outputCount: def.outputCount,
      additionalCount: def.additionalCount,
      x,
      y,
    });
  };

  export const NodeRenderer: React.FC<{ id: string; store: any, font: any, iconFont: any }> = (props) => {
    // Сейчас у нас один тип визуализации, но в будущем здесь может быть switch(node.type)
    return <NodeView {...props} />;
  };