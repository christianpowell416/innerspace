import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, PinchGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Line, Text as SvgText, G, Rect, Polygon, Path } from 'react-native-svg';
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
  onEdgeEditFromPopup?: (edge: FlowchartEdge) => void;
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
  onEdgeEditFromPopup,
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
  const [selectedEdge, setSelectedEdge] = useState<FlowchartEdge | null>(null);
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
  const opacity = useSharedValue(0); // Start with 0 opacity

  // Helper functions to generate shape paths
  const generatePentagonPath = (centerX: number, centerY: number, radius: number): string => {
    const points = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 2 * Math.PI / 5) - (Math.PI / 2); // Start from top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  const generateHexagonPath = (centerX: number, centerY: number, radius: number): string => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i * 2 * Math.PI / 6) - (Math.PI / 2); // Start from top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  const generateTrianglePath = (centerX: number, centerY: number, radius: number): string => {
    const points = [];
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI / 3) - (Math.PI / 2); // Start from top
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

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

  // Helper function to calculate node radius (matches renderNode logic)
  const calculateNodeRadius = (node: FlowchartNode) => {
    // Return the uniform maximum radius for all nodes
    return maxNodeRadius;
  };

  // Calculate initial centering offset when flowchart loads or structure changes
  // Calculate viewBox that contains all content
  const [viewBoxDimensions, setViewBoxDimensions] = useState({ x: 0, y: 0, width: width, height: height });
  
  // Calculate the maximum radius needed for all nodes to ensure uniform sizing
  const maxNodeRadius = useMemo(() => {
    if (!flowchart || flowchart.nodes.length === 0) return 35;
    
    const lineHeight = 16; // Define lineHeight constant
    
    const radii = flowchart.nodes.map(node => {
      const nodeLabel = node.label || node.id || 'Untitled';
      const wrappedLines = wrapTextForCircle(nodeLabel);
      const maxLineLength = Math.max(...wrappedLines.map(line => line.length));
      const textHeight = wrappedLines.length * lineHeight;
      const textWidth = maxLineLength * 8; // Approximate character width
      return Math.max(35, Math.max(textWidth / 2, textHeight / 2) + 15);
    });
    
    return Math.max(...radii);
  }, [flowchart?.nodes, flowchart?.nodes?.map(n => n.type).join(',')]);
  
  // Track node count and IDs to detect structural changes vs position changes
  const nodeCount = flowchart?.nodes.length || 0;
  const nodeIds = flowchart?.nodes.map(n => n.id).sort().join(',') || '';
  
  useEffect(() => {
    if (flowchart && flowchart.nodes.length > 0) {
      console.log(`📱 FlowchartViewer viewport: ${width}x${height}`);
      
      // Use the helper function to set initial viewBox
      updateViewBoxForNodes(flowchart.nodes);
      
      // Reset transforms since viewBox handles positioning
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      
      // Fade in after positioning
      opacity.value = 1;
    }
  }, [nodeCount, nodeIds, width, height, updateViewBoxForNodes]); // Only recenter when structure changes, not positions

  const handleNodePress = useCallback((node: FlowchartNode) => {
    if (!isDragging) {
      setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
      setSelectedEdge(null); // Clear edge selection when selecting a node
      onNodeSelect?.(node);
    }
  }, [selectedNodeId, onNodeSelect, isDragging]);

  const handleEdgePress = useCallback((edge: FlowchartEdge) => {
    setSelectedEdge(prevEdge => 
      prevEdge && prevEdge.from === edge.from && prevEdge.to === edge.to ? null : edge
    );
    setSelectedNodeId(null); // Clear node selection when selecting an edge
    onEdgeEdit?.(edge);
  }, [onEdgeEdit]);

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

  // Helper function to update viewBox when nodes move
  const updateViewBoxForNodes = useCallback((nodes: FlowchartNode[]) => {
    if (!nodes || nodes.length === 0) return;
    
    // Find the bounds of all nodes including their radius
    const nodeBounds = nodes.map(node => {
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
    
    // Calculate content dimensions
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Calculate viewBox to fit all content with padding
    const viewBoxPadding = 50;
    const viewBoxX = minX - viewBoxPadding;
    const viewBoxY = minY - viewBoxPadding;
    const viewBoxWidth = contentWidth + (viewBoxPadding * 2);
    const viewBoxHeight = contentHeight + (viewBoxPadding * 2);
    
    setViewBoxDimensions({ 
      x: viewBoxX, 
      y: viewBoxY, 
      width: viewBoxWidth, 
      height: viewBoxHeight 
    });
    
    console.log(`📐 Updated ViewBox: ${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`);
  }, []);

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
          // Convert screen pixel coordinates to SVG viewBox coordinates
          // Account for both scale transform and viewBox scaling
          const viewBoxScale = viewBoxDimensions.width / width; // Ratio of viewBox to screen
          const deltaX = (event.translationX / scale.value) * viewBoxScale;
          const deltaY = (event.translationY / scale.value) * viewBoxScale;
          const newX = nodeStartPos.value.x + deltaX;
          const newY = nodeStartPos.value.y + deltaY;
          
          if (onNodeMove) {
            runOnJS(onNodeMove)(draggedNodeIdShared.value, newX, newY);
            // Update viewBox dynamically during drag to prevent clipping
            const updatedNodes = flowchart.nodes.map(node => 
              node.id === draggedNodeIdShared.value 
                ? { ...node, x: newX, y: newY }
                : node
            );
            runOnJS(updateViewBoxForNodes)(updatedNodes);
          }
        }
        // Explicitly do nothing for panning when in drag mode
        return;
      }
      
      // Normal pan behavior (only when definitely not in drag mode)
      // Adjust translation based on current scale to maintain 1:1 finger movement
      translateX.value = context.startX + (event.translationX / scale.value);
      translateY.value = context.startY + (event.translationY / scale.value);
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
        { scale: scale.value },
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    };
  });

  // Helper function to render the appropriate shape based on node type
  const renderNodeShape = (node: FlowchartNode, radius: number, circleColor: string, strokeColor: string, strokeWidth: number, opacity: number) => {
    const { x, y, type } = node;
    
    // Debug logging to check node type
    console.log(`🔶 Rendering node ${node.id} with type: "${type}"`);
    
    const commonProps = {
      fill: circleColor,
      stroke: strokeColor,
      strokeWidth: strokeWidth,
      opacity: opacity,
      onPress: () => handleNodePress(node),
      onLongPress: () => handleLongPress(node),
    };

    const nodeType = String(type).toLowerCase().trim();
    
    switch (nodeType) {
      case 'need':
        console.log(`🔶 Rendering PENTAGON for node ${node.id}`);
        return (
          <Polygon
            points={generatePentagonPath(x, y, radius)}
            {...commonProps}
          />
        );
      case 'self':
        console.log(`🔶 Rendering CIRCLE for node ${node.id}`);
        return (
          <Circle
            cx={x}
            cy={y}
            r={radius}
            {...commonProps}
          />
        );
      case 'manager':
        console.log(`🔶 Rendering HEXAGON for node ${node.id}`);
        return (
          <Polygon
            points={generateHexagonPath(x, y, radius)}
            {...commonProps}
          />
        );
      case 'exile':
        console.log(`🔶 Rendering SQUARE for node ${node.id}`);
        return (
          <Rect
            x={x - radius}
            y={y - radius}
            width={radius * 2}
            height={radius * 2}
            {...commonProps}
          />
        );
      case 'firefighter':
        console.log(`🔶 Rendering TRIANGLE for node ${node.id}`);
        return (
          <Polygon
            points={generateTrianglePath(x, y, radius)}
            {...commonProps}
          />
        );
      default:
        console.log(`🔶 Rendering DEFAULT CIRCLE for node ${node.id} (unknown type: "${nodeType}")`);
        return (
          <Circle
            cx={x}
            cy={y}
            r={radius}
            {...commonProps}
          />
        );
    }
  };

  const renderNode = (node: FlowchartNode) => {
    const isSelected = selectedNodeId === node.id;
    const isConnectingFrom = connectingFromNode?.id === node.id;
    const isBeingDragged = isDragging && draggedNodeId === node.id;
    const isDragTarget = false; // No longer needed without drag mode button
    const textColor = '#000000'; // Always black text
    const nodeColor = PartColors[node.type] || '#808080';
    
    // Wrap text and use uniform radius for all nodes
    const nodeLabel = node.label || node.id || 'Untitled';
    const wrappedLines = wrapTextForCircle(nodeLabel);
    
    // Use the maximum radius calculated for all nodes
    const radius = maxNodeRadius;
    
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
        {/* Node shape background */}
        {renderNodeShape(node, radius, circleColor, strokeColor, strokeWidth, opacity)}
        {/* Multi-line text label */}
        {wrappedLines.map((line, index) => {
          const totalLines = wrappedLines.length;
          const lineHeight = 16; // Define lineHeight constant for text rendering
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
    const isSelected = selectedEdge && selectedEdge.from === edge.from && selectedEdge.to === edge.to;
    const lineColor = '#FFFFFF'; // Always white lines
    const strokeWidth = isSelected ? style.strokeWidth + 2 : style.strokeWidth; // Thicker when selected
    const opacity = isSelected ? 1 : 0.7; // More opaque when selected

    // Calculate midpoint for label placement
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    
    // Calculate angle for text rotation (optional - can be removed if rotation not desired)
    const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * (180 / Math.PI);
    
    // Capitalize first letter of relationship type for display
    const displayLabel = edge.label || edge.type.charAt(0).toUpperCase() + edge.type.slice(1);

    return (
      <G key={`${edge.from}-${edge.to}`}>
        {/* Edge line */}
        <Line
          x1={fromNode.x}
          y1={fromNode.y}
          x2={toNode.x}
          y2={toNode.y}
          stroke={lineColor}
          strokeWidth={strokeWidth}
          strokeDasharray={style.strokeDasharray}
          opacity={opacity}
          onPress={() => handleEdgePress(edge)}
        />
        {/* Edge label background rectangle for better readability */}
        <Rect
          x={midX - (displayLabel.length * 3)}
          y={midY - 15}
          width={displayLabel.length * 6}
          height={14}
          fill={isSelected ? '#FF9500' : '#000000'}
          opacity={isSelected ? 0.9 : 0.7}
          rx={3}
          ry={3}
          onPress={() => handleEdgePress(edge)}
        />
        {/* Edge label text */}
        <SvgText
          x={midX}
          y={midY - 6}
          fontSize="10"
          textAnchor="middle"
          fill="#FFFFFF"
          fontWeight="600"
          opacity={1}
          onPress={() => handleEdgePress(edge)}
        >
          {displayLabel}
        </SvgText>
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
      // Clear selections when clicking empty space
      setSelectedNodeId(null);
      setSelectedEdge(null);
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
                viewBox={`${viewBoxDimensions.x} ${viewBoxDimensions.y} ${viewBoxDimensions.width} ${viewBoxDimensions.height}`}
                onPress={handleSvgPress}
                preserveAspectRatio="xMidYMid meet"
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
      
      {/* Edge info panel */}
      {selectedEdge && (
        <Pressable 
          style={[
            styles.infoPanel, 
            { backgroundColor: colorScheme === 'dark' ? '#333' : '#F5F5F5' }
          ]}
          onPress={() => isEditMode && onEdgeEditFromPopup?.(selectedEdge)}
        >
          <Text style={[
            styles.infoTitle,
            { color: colorScheme === 'dark' ? '#FFF' : '#000' }
          ]}>
            Relationship: {selectedEdge.type.charAt(0).toUpperCase() + selectedEdge.type.slice(1)}
          </Text>
          <Text style={[
            styles.infoType,
            { color: RelationshipStyles[selectedEdge.type]?.color || '#808080' }
          ]}>
            {(() => {
              const fromNode = flowchart.nodes.find(n => n.id === selectedEdge.from);
              const toNode = flowchart.nodes.find(n => n.id === selectedEdge.to);
              return `${fromNode?.label || selectedEdge.from} → ${toNode?.label || selectedEdge.to}`;
            })()}
          </Text>
          <Text style={[
            styles.infoDescription,
            { color: colorScheme === 'dark' ? '#CCC' : '#666' }
          ]}>
            {selectedEdge.label || (isEditMode ? 'Tap to edit relationship' : 'No custom label')}
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