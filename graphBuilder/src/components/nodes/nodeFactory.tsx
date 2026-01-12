// const CATEGORIES = [
//     { title: 'Common', data: ['Code', 'Filter', 'Merge'] },
//     { title: 'Events', data: ['Flash Light', 'Vibration'] },
//     { title: 'Trigger', data: ['Webhook', 'Schedule', 'On App Event'] },
//     { title: 'AI', data: ['AI Agent', 'OpenAI', 'Document Loader'] },
//   ];

import {} from './Node'


// Типы нод, которые есть в твоем приложении
export type NodeType = 'code' | 'filter' | 'merge' | 'flashlight' | 'vibration' | 'webhook' | 'schedule' | 'on_app_event' | 'ai_agent' | 'openAI' | 'document_loader';

interface NodeDefinition {
  label: string;
  color: string;
  inputCount: number;
  outputCount: number;
}

// Реестр настроек нод
const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
    code: {label: 'Code', color: '#ffffff', inputCount: 1, outputCount: 1},
    filter: {label: 'Filter', color: '#ffffff', inputCount: 1, outputCount: 1},
    merge: {label: 'Merge', color: '#ffffff', inputCount: 5, outputCount: 1},
    flashlight: {label: 'Flash Light', color: '#ffffff', inputCount: 1, outputCount: 1},
    vibration: {label: 'Vibration', color: '#ffffff', inputCount: 1, outputCount: 1},
    webhook: {label: 'Webhook', color: '#ffffff', inputCount: 1, outputCount: 1},
    schedule: {label: 'Schedule', color: '#ffffff', inputCount: 0, outputCount: 1},
    on_app_event: {label: 'On App Event', color: '#ffffff', inputCount: 1, outputCount: 1},
    ai_agent: {label: 'AI Agent', color: '#ffffff', inputCount: 0, outputCount: 1},
    openAI: {label: 'openAI', color: '#ffffff', inputCount: 0, outputCount: 1},
    document_loader: {label: 'Document Loader', color: '#ffffff', inputCount: 0, outputCount: 1},


//   trigger: { label: 'Code', color: '#ffcc00', inputCount: 0, outputCount: 1 },
//   action: { label: 'Settings', color: '#44ff44', inputCount: 1, outputCount: 1 },
//   flashlight: { label: 'Flashlight', color: '#ffffff', inputCount: 1, outputCount: 0 },
//   logic: { label: 'Code', color: '#ff4444', inputCount: 2, outputCount: 1 },
//   settings: { label: 'Settings', color: '#aaaaaa', inputCount: 1, outputCount: 1 },
};