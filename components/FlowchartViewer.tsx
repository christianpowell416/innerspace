import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedGestureHandler } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { 
  FlowchartStructure, 
  FlowchartNode, 
  FlowchartEdge, 
  PartColors, 
  RelationshipStyles,
  PartType 
} from '@/lib/types/flowchart';
import { useColorScheme } from '@/hooks/useColorScheme';

interface FlowchartViewerProps {
  flowchart: FlowchartStructure;
  onNodeSelect?: (node: FlowchartNode) => void;
  onNodeEdit?: (node: FlowchartNode) => void;
  onEdgeEdit?: (edge: FlowchartEdge) => void;
  width?: number;
  height?: number;
  editable?: boolean;
}

export function FlowchartViewer({
  flowchart,
  onNodeSelect,
  onNodeEdit,
  onEdgeEdit,
  width = 400,
  height = 400,
  editable = false
}: FlowchartViewerProps) {
  const colorScheme = useColorScheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Gesture and animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Calculate initial centering offset when flowchart loads
  useEffect(() => {
    if (flowchart && flowchart.nodes.length > 0) {
      // Find the bounds of all nodes
      const allX = flowchart.nodes.map(n => n.x);
      const allY = flowchart.nodes.map(n => n.y);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      
      // Calculate the center of the flowchart content
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;
      
      // Calculate screen center
      const screenCenterX = width / 2;
      const screenCenterY = height / 2;
      
      // Set initial translation to center the content
      translateX.value = screenCenterX - contentCenterX;
      translateY.value = screenCenterY - contentCenterY;
    }
  }, [flowchart, width, height, translateX, translateY]);

  const handleNodePress = useCallback((node: FlowchartNode) => {
    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
    onNodeSelect?.(node);
  }, [selectedNodeId, onNodeSelect]);

  const handleNodeLongPress = useCallback((node: FlowchartNode) => {
    if (editable) {
      onNodeEdit?.(node);
    }
  }, [editable, onNodeEdit]);

  // Pinch gesture handler for zoom
  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startScale = scale.value;
    },
    onActive: (event, context) => {
      scale.value = Math.max(0.5, Math.min(3, context.startScale * event.scale));
    },
  });

  // Pan gesture handler for movement
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
  });

  // Animated style for the SVG container
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const renderNode = (node: FlowchartNode) => {
    const isSelected = selectedNodeId === node.id;
    const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';

    return (
      <G key={node.id}>
        <SvgText
          x={node.x}
          y={node.y}
          fontSize="14"
          textAnchor="middle"
          fill={textColor}
          fontWeight={isSelected ? 'bold' : 'normal'}
          onPress={() => handleNodePress(node)}
          onLongPress={() => handleNodeLongPress(node)}
        >
          {node.label}
        </SvgText>
      </G>
    );
  };

  const renderEdge = (edge: FlowchartEdge) => {
    const fromNode = flowchart.nodes.find(n => n.id === edge.from);
    const toNode = flowchart.nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return null;

    const style = RelationshipStyles[edge.type] || { strokeWidth: 2, strokeDasharray: '0', color: '#808080' }; // Default style
    const lineColor = colorScheme === 'dark' ? style.color : style.color;

    return (
      <G key={`${edge.from}-${edge.to}`}>
        <Line
          x1={fromNode.x}
          y1={fromNode.y}
          x2={toNode.x}
          y2={toNode.y}
          stroke={lineColor}
          strokeWidth={style.strokeWidth}
          strokeDasharray={style.strokeDasharray}
          opacity={0.7}
          onPress={() => onEdgeEdit?.(edge)}
        />
      </G>
    );
  };

  const getPartTypeLabel = (type: PartType): string => {
    switch (type) {
      case 'self': return 'Self';
      case 'manager': return 'Manager';
      case 'firefighter': return 'Firefighter';
      case 'exile': return 'Exile';
      default: return 'Unknown';
    }
  };

  const selectedNode = selectedNodeId 
    ? flowchart.nodes.find(n => n.id === selectedNodeId)
    : null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
        <Animated.View>
          <PanGestureHandler onGestureEvent={panGestureHandler}>
            <Animated.View style={animatedStyle}>
              <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                {/* Render edges first (behind nodes) */}
                {flowchart.edges.map(renderEdge)}
                
                {/* Render nodes */}
                {flowchart.nodes.map(renderNode)}
              </Svg>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>
      
      {/* Node info panel */}
      {selectedNode && (
        <View style={[
          styles.infoPanel, 
          { backgroundColor: colorScheme === 'dark' ? '#333' : '#F5F5F5' }
        ]}>
          <Text style={[
            styles.infoTitle,
            { color: colorScheme === 'dark' ? '#FFF' : '#000' }
          ]}>
            {selectedNode.label}
          </Text>
          <Text style={[
            styles.infoType,
            { color: PartColors[selectedNode.type] || '#808080' }
          ]}>
            {getPartTypeLabel(selectedNode.type)}
          </Text>
          {selectedNode.description && (
            <Text style={[
              styles.infoDescription,
              { color: colorScheme === 'dark' ? '#CCC' : '#666' }
            ]}>
              {selectedNode.description}
            </Text>
          )}
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoType: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});