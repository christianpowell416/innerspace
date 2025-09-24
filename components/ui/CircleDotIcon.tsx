import React from 'react';
import { Svg, Circle } from 'react-native-svg';

interface CircleDotIconProps {
  size?: number;
  color?: string;
}

export function CircleDotIcon({ size = 28, color = '#000' }: CircleDotIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Outer circle with thick border */}
      <Circle
        cx="50"
        cy="50"
        r="40"
        stroke={color}
        strokeWidth="12"
        fill="none"
      />
      {/* Inner solid dot */}
      <Circle
        cx="50"
        cy="50"
        r="12"
        fill={color}
      />
    </Svg>
  );
}