import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const MENU_ICONS = [
  { name: 'play', action: 'execute' },
  { name: 'power', action: 'deactivate' },
  { name: 'trash-can-outline', action: 'delete' },
];

export const NodeMenuOverlay: React.FC<MenuOverlayProps> = ({ visible, x, y, width, scale, onAction }) => {
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: 200 }),
      transform: [
        { scale: withSpring(visible ? 1 : 0.8, { damping: 15, stiffness: 150 }) },
      ],
    };
  });

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
          style={[styles.iconButton, { width: scale * 16, height: scale * 16 }]}
          activeOpacity={0.7}
        >
          <Icon name={icon.name} size={scale * 16} color="#FFFFFF" />
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    flexDirection: 'column',
    backgroundColor: '#1E1E1E',
    borderRadius: 25,
    padding: 6,
    gap: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  iconButton: {
    borderRadius: 4,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  }
});