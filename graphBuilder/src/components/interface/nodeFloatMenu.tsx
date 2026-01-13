import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// 1. Выносим конфиг иконок наружу
const MENU_ICONS = [
  { name: 'play', action: 'execute' },
  { name: 'power', action: 'deactivate' },
  { name: 'trash-can-outline', action: 'delete' },
];

export const NodeMenuOverlay: React.FC<MenuOverlayProps> = ({ visible, x, y, width, onAction }) => {
  
  // 2. Анимированный стиль для появления
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
      transform: [
        { scale: withSpring(visible ? 1 : 0.8, { damping: 15, stiffness: 150 }) },
      ],
    };
  });

  // 3. Важно: используем pointerEvents вместо return null
  return (
    <Animated.View 
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.menuContainer, 
        { left: x + width + 10, top: y }, 
        animatedStyle 
      ]}
    >
      {MENU_ICONS.map((icon) => (
        <TouchableOpacity 
          key={icon.action} 
          onPress={() => onAction(icon.action)} 
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <Icon name={icon.name} size={16} color="#FFFFFF" />
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    flexDirection: 'column',
    backgroundColor: '#1E1E1E', // Темный фон
    borderRadius: 25,
    padding: 6,
    gap: 8,
    elevation: 8, // Тень для Android
    shadowColor: '#000', // Тень для iOS
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  iconButton: {
    width: 16,
    height: 16,
    borderRadius: 16,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  }
});
