import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, runOnJS } from 'react-native-reanimated';
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
  onNodeDescriptionEdit?: (node: FlowchartNode) => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onEdgeEdit?: (edge: FlowchartEdge) => void;
  onEmptySpaceTap?: (x: number, y: number) => void;
  width?: number;
  height?: number;
  editable?: boolean;
  isEditMode?: boolean;
  isConnectMode?: boolean;
  connectingFromNode?: FlowchartNode | null;
}

export function FlowchartViewer({
  flowchart,
  onNodeSelect,
  onNodeEdit,
  onNodeDescriptionEdit,
  onNodeMove,
  onEdgeEdit,
  onEmptySpaceTap,
  width = 400,
  height = 400,
  editable = false,
  isEditMode = false,
  isConnectMode = false,
  connectingFromNode = null
}: FlowchartViewerProps) {
  const colorScheme = useColorScheme();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  
  // Shared values for gesture handler (all drag-related values)
  const isDraggingShared = useSharedValue(false);
  const draggedNodeIdShared = useSharedValue<string | null>(null);
  const dragStartPos = useSharedValue({ x: 0, y: 0 });
  const nodeStartPos = useSharedValue({ x: 0, y: 0 });
  
  // Gesture and animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Helper function to calculate node radius (matches renderNode logic)
  const calculateNodeRadius = (node: FlowchartNode) => {
    const nodeLabel = node.label || node.id || 'Untitled';
    const wrappedLines = wrapTextForCircle(nodeLabel);
    const maxLineLength = Math.max(...wrappedLines.map(line => line.length));
    const lineHeight = 16;
    const textHeight = wrappedLines.length * lineHeight;
    const textWidth = maxLineLength * 8; // Approximate character width
    return Math.max(35, Math.max(textWidth / 2, textHeight / 2) + 15);
  };

  // Calculate initial centering offset when flowchart loads or structure changes
  // Track node count and IDs to detect structural changes vs position changes
  const nodeCount = flowchart?.nodes.length || 0;
  const nodeIds = flowchart?.nodes.map(n => n.id).sort().join(',') || '';
  
  useEffect(() => {
    if (flowchart && flowchart.nodes.length > 0) {
      console.log(`📱 FlowchartViewer viewport: ${width}x${height}`);
      
      // Find the bounds of all nodes including their radius
      const nodeBounds = flowchart.nodes.map(node => {
        const radius = calculateNodeRadius(node);
        return {
          minX: node.x - radius,
          maxX: node.x + radius,
          minY: node.y - radius,
          maxY: node.y + radius
        };
      });
      
      const minX = Math.min(...nodeBounds.map(b => b.minX));
      const maxX = Math.max(...nodeBounds.map(b => b.maxX));
      const minY = Math.min(...nodeBounds.map(b => b.minY));
      const maxY = Math.max(...nodeBounds.map(b => b.maxY));
      
      console.log(`📐 Flowchart bounds (including radius): X(${minX} to ${maxX}), Y(${minY} to ${maxY})`);
      console.log(`📏 Flowchart size: ${maxX - minX}x${maxY - minY}`);
      
      // Calculate the center of the flowchart content
      const contentCenterX = (minX + maxX) / 2;
      const contentCenterY = (minY + maxY) / 2;
      
      // Calculate screen center (original coordinate system)
      const screenCenterX = width / 2;
      const screenCenterY = height / 2;
      
      // Set initial translation to center the content with additional safety margin
      // Account for the fact that viewBox extends beyond visible area
      const safetyMargin = 20; // Additional margin to ensure bottom nodes aren't cut off
      translateX.value = screenCenterX - contentCenterX;
      translateY.value = screenCenterY - contentCenterY + safetyMargin; // Shift up slightly
    }
  }, [nodeCount, nodeIds, width, height, translateX, translateY]); // Only recenter when structure changes, not positions

  const handleNodePress = useCallback((node: FlowchartNode) => {
    if (!isDragging) {
      setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
      onNodeSelect?.(node);
    }
  }, [selectedNodeId, onNodeSelect, isDragging]);

  const handleLongPress = useCallback((node: FlowchartNode) => {
    console.log('Long press detected on node:', node.id);
    if (!isDragging) {
      // Auto-enable drag mode and start dragging
      setIsDragging(true);
      setDraggedNodeId(node.id);
      setSelectedNodeId(node.id);
      
      // Set shared values for gesture handler
      isDraggingShared.value = true;
      draggedNodeIdShared.value = node.id;
      nodeStartPos.value = { x: node.x, y: node.y };
      dragStartPos.value = { x: 0, y: 0 }; // Will be updated in onStart
      
      console.log('Started dragging node:', node.id);
    }
  }, [isDragging]);


  // Pinch gesture handler for zoom (disabled when dragging)
  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      if (!isDraggingShared.value) {
        context.startScale = scale.value;
      }
    },
    onActive: (event, context) => {
      if (!isDraggingShared.value) {
        scale.value = Math.max(0.5, Math.min(3, context.startScale * event.scale));
      }
    },
  });

  // Pan gesture handler for movement and dragging
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (event, context) => {
      // Store initial pan state
      context.startX = translateX.value;
      context.startY = translateY.value;
      context.isDragMode = isDraggingShared.value;
      
      if (isDraggingShared.value && draggedNodeIdShared.value) {
        dragStartPos.value = { x: event.x, y: event.y };
        // nodeStartPos is already set in handleLongPress
        console.log('Pan handler: Starting node drag mode');
      }
    },
    onActive: (event, context) => {
      // Prioritize drag mode - if we started in drag mode or are currently dragging, disable panning
      if (isDraggingShared.value || context.isDragMode) {
        if (draggedNodeIdShared.value) {
          // Handle node dragging - completely disable panning
          // Convert screen coordinates to SVG coordinates accounting for current transform
          // Scale factor of 3 to compensate for the larger viewBox (3x coordinate space)
          const dragSensitivity = 3;
          const deltaX = (event.x - dragStartPos.value.x) / scale.value * dragSensitivity;
          const deltaY = (event.y - dragStartPos.value.y) / scale.value * dragSensitivity;
          const newX = nodeStartPos.value.x + deltaX;
          const newY = nodeStartPos.value.y + deltaY;
          
          if (onNodeMove) {
            runOnJS(onNodeMove)(draggedNodeIdShared.value, newX, newY);
          }
        }
        // Explicitly do nothing for panning when in drag mode
        return;
      }
      
      // Normal pan behavior (only when definitely not in drag mode)
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
    onEnd: () => {
      if (isDraggingShared.value) {
        isDraggingShared.value = false;
        draggedNodeIdShared.value = null;
        runOnJS(setIsDragging)(false);
        console.log('Pan handler: Ending node drag mode');
        // Don't reset draggedNodeId - keep it selected for potential next drag
      }
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

  // Helper function to wrap text optimally for circular display
  const wrapTextForCircle = (text: string, maxCharsPerLine: number = 12): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word itself is too long, break it
          lines.push(word.substring(0, maxCharsPerLine));
          currentLine = word.substring(maxCharsPerLine);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  const renderNode = (node: FlowchartNode) => {
    const isSelected = selectedNodeId === node.id;
    const isConnectingFrom = connectingFromNode?.id === node.id;
    const isBeingDragged = isDragging && draggedNodeId === node.id;
    const isDragTarget = false; // No longer needed without drag mode button
    const textColor = '#000000'; // Always black text
    const nodeColor = PartColors[node.type] || '#808080';
    
    // Wrap text and calculate circle radius based on wrapped text
    const nodeLabel = node.label || node.id || 'Untitled';
    const wrappedLines = wrapTextForCircle(nodeLabel);
    const maxLineLength = Math.max(...wrappedLines.map(line => line.length));
    const lineHeight = 16;
    const textHeight = wrappedLines.length * lineHeight;
    const textWidth = maxLineLength * 8; // Approximate character width
    
    // Calculate radius to fit text comfortably (add padding)
    const radius = Math.max(35, Math.max(textWidth / 2, textHeight / 2) + 15);
    
    // Background color for circle (always white)
    const circleColor = '#FFFFFF';
    
    let strokeColor = '#FFFFFF';
    let strokeWidth = 2;
    let opacity = 1;
    
    if (isBeingDragged) {
      strokeColor = '#9B59B6'; // Purple for dragging
      strokeWidth = 4;
      opacity = 0.8;
    } else if (isDragTarget) {
      strokeColor = '#9B59B6'; // Purple border in drag mode
      strokeWidth = 3;
    } else if (isConnectingFrom) {
      strokeColor = '#FF9500';
      strokeWidth = 4;
    } else if (isSelected) {
      strokeColor = nodeColor;
      strokeWidth = 3;
    }

    return (
      <G key={node.id}>
        {/* Circle background */}
        <Circle
          cx={node.x}
          cy={node.y}
          r={radius}
          fill={circleColor}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          onPress={() => handleNodePress(node)}
          onLongPress={() => handleLongPress(node)}
        />
        {/* Multi-line text label */}
        {wrappedLines.map((line, index) => {
          const totalLines = wrappedLines.length;
          const textBlockHeight = (totalLines - 1) * lineHeight;
          const startY = node.y - (textBlockHeight / 2) + (lineHeight * 0.35); // Add baseline offset
          const yPosition = startY + (index * lineHeight);
          
          return (
            <SvgText
              key={index}
              x={node.x}
              y={yPosition}
              fontSize="14"
              textAnchor="middle"
              fill={textColor}
              fontWeight={isSelected ? 'bold' : 'normal'}
              opacity={opacity}
              onPress={() => handleNodePress(node)}
              onLongPress={() => handleLongPress(node)}
            >
              {line}
            </SvgText>
          );
        })}
      </G>
    );
  };

  const renderEdge = (edge: FlowchartEdge) => {
    const fromNode = flowchart.nodes.find(n => n.id === edge.from);
    const toNode = flowchart.nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return null;

    const style = RelationshipStyles[edge.type] || { strokeWidth: 2, strokeDasharray: '0', color: '#808080' }; // Default style
    const lineColor = '#FFFFFF'; // Always white lines

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

  const getPartTypeLabel = (type: PartType | string): string => {
    // Handle the predefined IFS types
    switch (type) {
      case 'self': return 'Self';
      case 'manager': return 'Manager';
      case 'firefighter': return 'Firefighter';
      case 'exile': return 'Exile';
      default: 
        // For any other type, capitalize first letter and return as-is
        return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Unknown';
    }
  };

  const selectedNode = selectedNodeId 
    ? flowchart.nodes.find(n => n.id === selectedNodeId)
    : null;

  const handleSvgPress = (event: any) => {
    if (!isEditMode || !onEmptySpaceTap) return;

    // Get the coordinates relative to the SVG viewport
    const { locationX, locationY } = event.nativeEvent;
    
    // Transform coordinates back to world space accounting for pan and zoom
    const worldX = (locationX - translateX.value) / scale.value;
    const worldY = (locationY - translateY.value) / scale.value;
    
    // Check if we clicked on empty space (not on a node)
    const clickedNode = flowchart.nodes.find(node => {
      const distance = Math.sqrt(
        Math.pow(node.x - worldX, 2) + Math.pow(node.y - worldY, 2)
      );
      return distance < 40; // 40px radius for node hit detection
    });
    
    if (!clickedNode) {
      onEmptySpaceTap(worldX, worldY);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
        <Animated.View>
          <PanGestureHandler onGestureEvent={panGestureHandler}>
            <Animated.View style={animatedStyle}>
              <Svg 
                width={width} 
                height={height} 
                viewBox={`-${width} -${height} ${width * 3} ${height * 3}`}
                onPress={handleSvgPress}
              >
                {/* Render edges first (behind nodes) */}
                {flowchart.edges.map(renderEdge)}
                
                {/* Render nodes */}
                {flowchart.nodes.map(renderNode)}
              </Svg>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>
      
      {/* Connect mode indicator */}
      {isConnectMode && (
        <View style={styles.connectModeIndicator}>
          <Text style={styles.connectModeText}>Tap a node to connect from "{connectingFromNode?.label || connectingFromNode?.id || 'Unknown'}"</Text>
        </View>
      )}
      
      {/* Drag indicator - shows when actively dragging */}
      {isDragging && (
        <View style={styles.dragModeIndicator}>
          <Text style={styles.dragModeText}>
            {isDragging ? (() => {
              const draggedNode = flowchart.nodes.find(n => n.id === draggedNodeId);
              const nodeName = draggedNode?.label || draggedNode?.id || 'Unknown';
              return `Dragging "${nodeName}"`;
            })() : 'Press and hold a node to drag it'}
          </Text>
        </View>
      )}
      
      {/* Node info panel */}
      {selectedNode && (
        <Pressable 
          style={[
            styles.infoPanel, 
            { backgroundColor: colorScheme === 'dark' ? '#333' : '#F5F5F5' }
          ]}
          onPress={() => isEditMode && onNodeDescriptionEdit?.(selectedNode)}
        >
          <Text style={[
            styles.infoTitle,
            { color: colorScheme === 'dark' ? '#FFF' : '#000' }
          ]}>
            {selectedNode.label || selectedNode.id || 'Untitled'}
          </Text>
          <Text style={[
            styles.infoType,
            { color: PartColors[selectedNode.type] || '#808080' }
          ]}>
            {getPartTypeLabel(selectedNode.type)}
          </Text>
          <Text style={[
            styles.infoDescription,
            { color: colorScheme === 'dark' ? '#CCC' : '#666' }
          ]}>
            {selectedNode.description || (isEditMode ? 'Tap to add description' : 'No description')}
          </Text>
        </Pressable>
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
    top: 50,
    left: 80,
    right: 80,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10000,
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
  editHint: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  connectModeIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#FF9500',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectModeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dragModeIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: '#9B59B6',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  dragModeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});