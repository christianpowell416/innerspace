import { Platform, ViewStyle } from 'react-native';

interface ShadowProps {
  shadowColor?: string;
  shadowOffset?: {
    width: number;
    height: number;
  };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
}

export const createShadowStyle = (props: ShadowProps): ViewStyle => {
  const {
    shadowColor = '#000',
    shadowOffset = { width: 0, height: 2 },
    shadowOpacity = 0.25,
    shadowRadius = 4,
    elevation = 5,
  } = props;

  if (Platform.OS === 'web') {
    // Convert React Native shadow props to CSS boxShadow
    const offsetX = shadowOffset.width;
    const offsetY = shadowOffset.height;
    const blurRadius = shadowRadius * 2; // Approximate conversion
    const color = `rgba(0, 0, 0, ${shadowOpacity})`;
    
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${blurRadius}px ${color}`,
    } as ViewStyle;
  }

  // Return native shadow properties for iOS and Android
  return {
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    elevation,
  };
};