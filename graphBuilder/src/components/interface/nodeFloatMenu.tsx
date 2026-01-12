import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface MenuOverlayProps {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  onAction: (action: string) => void;
}

export const NodeMenuOverlay: React.FC<MenuOverlayProps> = ({ visible, x, y, width, onAction }) => {
  if (!visible) return null;

  // Иконки из вашего изображения
  const icons = [
    { name: 'play', action: 'execute' },
    { name: 'power', action: 'deactivate' },
    { name: 'trash-can-outline', action: 'delete' },
  ];

  const menuLeft = x + width + 10;
  const menuTop = y;

  return (
    <View style={[styles.menuContainer, { left: menuLeft, top: menuTop }]}>
      {icons.map((icon) => (
        <TouchableOpacity key={icon.action} onPress={() => onAction(icon.action)} style={styles.iconButton}>
          {/* Используем библиотеку react-native-vector-icons для нативных иконок */}
          <Icon name={icon.name} size={13} color="#FFFFFF" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    flexDirection: 'column',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 5,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  iconButton: {
    padding: 5,
    marginHorizontal: 2,
  },
});

export default NodeMenuOverlay;
