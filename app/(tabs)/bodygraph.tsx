import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Dimensions, Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FlowchartViewer } from '@/components/FlowchartViewer';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { GlassHeader } from '@/components/ui/GlassHeader';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { TextInputModal } from '@/components/TextInputModal';
import { NodeEditModal } from '@/components/NodeEditModal';
import { EdgeEditModal } from '@/components/EdgeEditModal';
import { FlowchartStructure, FlowchartNode, FlowchartEdge, PartType } from '@/lib/types/flowchart';
import { 
  getUserFlowchart,
  getUserFlowchartWithId, 
  updateFlowchartWithDescription,
  subscribeToFlowchartChanges,
  FlowchartRow,
  generateFlowchartFromRequirements,
  createFlowchart,
  exportFlowchartAsTemplate
} from '@/lib/services/flowcharts';
import { useAuth } from '@/contexts/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

export default function BodygraphScreen() {
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const [flowchart, setFlowchart] = useState<FlowchartStructure | null>(null);
  const [currentFlowchartId, setCurrentFlowchartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [nodeToRename, setNodeToRename] = useState<FlowchartNode | null>(null);
  const [nodeEditModalVisible, setNodeEditModalVisible] = useState(false);
  const [nodeToEdit, setNodeToEdit] = useState<FlowchartNode | null>(null);
  const [edgeEditModalVisible, setEdgeEditModalVisible] = useState(false);
  const [edgeToEdit, setEdgeToEdit] = useState<FlowchartEdge | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [connectingFromNode, setConnectingFromNode] = useState<FlowchartNode | null>(null);
  
  // Debounced position update
  const positionUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load flowchart on component mount
  useEffect(() => {
    loadFlowchart();
  }, [user]);

  // Clean up position update timeout on unmount
  useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Subscribe to real-time flowchart changes
  useEffect(() => {
    if (!user) return;

    const subscription = subscribeToFlowchartChanges((flowcharts: FlowchartRow[]) => {
      const defaultFlowchart = flowcharts.find(f => f.is_default);
      if (defaultFlowchart) {
        setFlowchart(defaultFlowchart.structure);
        setCurrentFlowchartId(defaultFlowchart.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  const loadFlowchart = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { structure, id } = await getUserFlowchartWithId();
      
      // Fix any nodes that don't have x,y coordinates
      const fixedStructure = {
        ...structure,
        nodes: structure.nodes.map((node, index) => {
          if (node.x === undefined || node.y === undefined || 
              typeof node.x !== 'number' || typeof node.y !== 'number' ||
              isNaN(node.x) || isNaN(node.y)) {
            console.log('🔧 Fixing node coordinates for:', node.id);
            // Arrange nodes in a circle pattern
            const angle = (index * 2 * Math.PI) / structure.nodes.length;
            const radius = 150;
            const centerX = 300;
            const centerY = 300;
            return {
              ...node,
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle)
            };
          }
          return node;
        })
      };
      
      setFlowchart(fixedStructure);
      
      // Set the flowchart ID for updates
      if (id) {
        setCurrentFlowchartId(id);
        console.log('✅ Loaded flowchart with ID:', id);
        
        // Save the fixed coordinates back to database if any were fixed
        const hasFixedNodes = structure.nodes.some(node => 
          node.x === undefined || node.y === undefined || 
          typeof node.x !== 'number' || typeof node.y !== 'number' ||
          isNaN(node.x) || isNaN(node.y)
        );
        
        if (hasFixedNodes) {
          console.log('💾 Saving fixed node coordinates to database...');
          try {
            await updateFlowchartWithDescription(id, fixedStructure, 'Fixed missing node coordinates');
            console.log('✅ Fixed coordinates saved to database');
          } catch (error) {
            console.warn('⚠️ Could not save fixed coordinates:', error);
          }
        }
      } else {
        console.log('ℹ️ Loaded flowchart without ID (non-authenticated)');
      }
    } catch (err) {
      console.error('❌ Error loading flowchart:', err);
      setError('Failed to load flowchart');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeSelect = (node: FlowchartNode) => {
    console.log('📍 Selected node:', node.id, '(', node.type, ')');
    
    // If in connect mode, create a relationship
    if (isConnectMode && connectingFromNode && node.id !== connectingFromNode.id) {
      createRelationship(connectingFromNode, node);
    }
  };

  const handleNodeEdit = (node: FlowchartNode) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to edit the flowchart');
      return;
    }

    if (!isEditMode) {
      return;
    }

    // Open rename modal
    setNodeToRename(node);
    setRenameModalVisible(true);
  };

  const handleRenameSubmit = (newName: string) => {
    if (nodeToRename && flowchart && currentFlowchartId) {
      updateNodeLabel(nodeToRename.id, newName);
    }
    setRenameModalVisible(false);
    setNodeToRename(null);
  };

  const handleRenameCancel = () => {
    setRenameModalVisible(false);
    setNodeToRename(null);
  };

  const handleNodeDescriptionEdit = (node: FlowchartNode) => {
    if (!user || !isEditMode) return;
    
    setNodeToEdit(node);
    setNodeEditModalVisible(true);
  };

  const handleNodeEditSubmit = async (updates: { id: string; type: string; description: string; transcripts: string[] }) => {
    if (nodeToEdit && flowchart && currentFlowchartId) {
      await updateNodeProperties(nodeToEdit.id, updates);
    }
    setNodeEditModalVisible(false);
    setNodeToEdit(null);
  };

  const handleNodeEditCancel = () => {
    setNodeEditModalVisible(false);
    setNodeToEdit(null);
  };

  const handleConnectMode = () => {
    if (nodeToEdit) {
      setConnectingFromNode(nodeToEdit);
      setIsConnectMode(true);
      setNodeEditModalVisible(false);
      Alert.alert('Connect Mode', 'Tap another node to create a relationship');
    }
  };

  const handleNodeDelete = async () => {
    if (!user || !flowchart || !currentFlowchartId || !nodeToEdit) {
      Alert.alert('Error', 'Unable to delete node');
      return;
    }

    Alert.alert(
      'Delete Node',
      `Are you sure you want to delete "${nodeToEdit.id}"? This will also remove all connected relationships.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove the node and all connected edges
              const updatedStructure: FlowchartStructure = {
                ...flowchart,
                nodes: flowchart.nodes.filter(node => node.id !== nodeToEdit.id),
                edges: flowchart.edges.filter(edge => 
                  edge.from !== nodeToEdit.id && edge.to !== nodeToEdit.id
                )
              };

              const changeDescription = `Deleted node "${nodeToEdit.id}" and all connected relationships`;

              await updateFlowchartWithDescription(
                currentFlowchartId,
                updatedStructure,
                changeDescription
              );

              // Update local state
              setFlowchart(updatedStructure);
              setNodeEditModalVisible(false);
              setNodeToEdit(null);

              console.log('✅ Deleted node:', nodeToEdit.id);
            } catch (err) {
              console.error('❌ Error deleting node:', err);
              Alert.alert('Error', 'Failed to delete node');
            }
          }
        }
      ]
    );
  };

  const createRelationship = async (fromNode: FlowchartNode, toNode: FlowchartNode) => {
    if (!flowchart || !currentFlowchartId) return;

    try {
      // Check if relationship already exists
      const existingEdge = flowchart.edges.find(
        edge => (edge.from === fromNode.id && edge.to === toNode.id) ||
                (edge.from === toNode.id && edge.to === fromNode.id)
      );

      if (existingEdge) {
        Alert.alert('Relationship Exists', 'These nodes are already connected');
        setIsConnectMode(false);
        setConnectingFromNode(null);
        return;
      }

      // Create new edge
      const newEdge: FlowchartEdge = {
        from: fromNode.id,
        to: toNode.id,
        type: 'protects' // Default relationship type
      };

      const updatedStructure: FlowchartStructure = {
        ...flowchart,
        edges: [...flowchart.edges, newEdge]
      };

      const changeDescription = `Created relationship from "${fromNode.id}" to "${toNode.id}" (protects)`;

      await updateFlowchartWithDescription(
        currentFlowchartId,
        updatedStructure,
        changeDescription
      );

      setFlowchart(updatedStructure);
      console.log('✅ Created relationship');
      Alert.alert('Success', `Connected "${fromNode.id}" to "${toNode.id}"`);
    } catch (err) {
      console.error('❌ Error creating relationship:', err);
      Alert.alert('Error', 'Failed to create relationship');
    } finally {
      setIsConnectMode(false);
      setConnectingFromNode(null);
    }
  };

  const updateNodeProperties = async (oldNodeId: string, updates: { id: string; type: string; description: string; transcripts: string[] }) => {
    console.log('🔧 updateNodeProperties called with:', { oldNodeId, updates });
    console.log('🔧 Current state:', { 
      hasFlowchart: !!flowchart, 
      currentFlowchartId, 
      user: !!user 
    });

    if (!flowchart || !currentFlowchartId) {
      console.error('❌ Missing flowchart or flowchart ID');
      Alert.alert('Error', 'Unable to update node. Missing flowchart data.');
      return;
    }

    try {
      const newNodeId = updates.id.trim();
      
      // Check if new ID already exists (unless it's the same as current)
      if (newNodeId !== oldNodeId && flowchart.nodes.some(node => node.id === newNodeId)) {
        Alert.alert('Error', `A node with ID "${newNodeId}" already exists. Please choose a different ID.`);
        return;
      }

      // Update the node with new properties
      const updatedNodes = flowchart.nodes.map(node =>
        node.id === oldNodeId 
          ? { ...node, id: newNodeId, type: updates.type as any, description: updates.description, transcripts: updates.transcripts }
          : node
      );

      // Update all edges that reference the old node ID
      const updatedEdges = flowchart.edges.map(edge => ({
        ...edge,
        from: edge.from === oldNodeId ? newNodeId : edge.from,
        to: edge.to === oldNodeId ? newNodeId : edge.to
      }));

      const updatedStructure: FlowchartStructure = {
        ...flowchart,
        nodes: updatedNodes,
        edges: updatedEdges
      };

      // Create change description for markdown
      const node = flowchart.nodes.find(n => n.id === oldNodeId);
      const changes = [];
      if (oldNodeId !== newNodeId) changes.push(`renamed from "${oldNodeId}" to "${newNodeId}"`);
      if (node?.type !== updates.type) changes.push(`changed type to ${updates.type}`);
      if (node?.description !== updates.description) changes.push(`updated description`);
      if (JSON.stringify(node?.transcripts || []) !== JSON.stringify(updates.transcripts)) changes.push(`updated transcripts`);
      
      const changeDescription = `Updated node: ${changes.join(', ')}`;
      
      console.log('🔧 About to call updateFlowchartWithDescription with:', {
        flowchartId: currentFlowchartId,
        changeDescription,
        nodeCount: updatedStructure.nodes.length
      });

      // Update in Supabase and append to markdown
      const result = await updateFlowchartWithDescription(
        currentFlowchartId,
        updatedStructure,
        changeDescription
      );

      console.log('✅ Successfully updated flowchart in Supabase:', result);

      // Update local state
      setFlowchart(updatedStructure);

      console.log('✅ Updated node properties successfully');
    } catch (err) {
      console.error('❌ Error updating node:', err);
      Alert.alert('Error', `Failed to update node: ${err.message}`);
    }
  };

  // Debounced function to save position changes to database
  const debouncedPositionUpdate = (
    nodeId: string, 
    x: number, 
    y: number, 
    updatedStructure: FlowchartStructure
  ) => {
    // Clear any existing timeout
    if (positionUpdateTimeoutRef.current) {
      clearTimeout(positionUpdateTimeoutRef.current);
    }

    // Set a new timeout to save after 1 second of no movement
    positionUpdateTimeoutRef.current = setTimeout(async () => {
      try {
        const node = updatedStructure.nodes.find(n => n.id === nodeId);
        const changeDescription = `Moved node "${node?.id}" to position (${Math.round(x)}, ${Math.round(y)})`;

        console.log('💾 Saving node position to database:', { nodeId, x: Math.round(x), y: Math.round(y) });

        await updateFlowchartWithDescription(
          currentFlowchartId!,
          updatedStructure,
          changeDescription
        );

        console.log('✅ Node position saved successfully');
      } catch (err) {
        console.error('❌ Error saving node position:', err);
        // Don't show alert for position save errors as it's not critical UX
      }
    }, 1000); // Wait 1 second after last movement
  };

  const handleNodeMove = async (nodeId: string, x: number, y: number) => {
    if (!flowchart || !currentFlowchartId || !isEditMode) return;

    try {
      // Update the local flowchart structure immediately for smooth dragging
      const updatedNodes = flowchart.nodes.map(node =>
        node.id === nodeId ? { ...node, x, y } : node
      );

      const updatedStructure: FlowchartStructure = {
        ...flowchart,
        nodes: updatedNodes
      };

      // Update local state immediately
      setFlowchart(updatedStructure);

      // Debounced database update (saves after 1 second of no movement)
      debouncedPositionUpdate(nodeId, x, y, updatedStructure);

    } catch (err) {
      console.error('❌ Error moving node:', err);
      Alert.alert('Error', 'Failed to move node');
    }
  };

  const updateNodeLabel = async (nodeId: string, newLabel: string) => {
    if (!flowchart || !currentFlowchartId) return;

    try {
      // Update the local flowchart structure
      const updatedNodes = flowchart.nodes.map(node =>
        node.id === nodeId ? { ...node, label: newLabel } : node
      );

      const updatedStructure: FlowchartStructure = {
        ...flowchart,
        nodes: updatedNodes
      };

      // Create change description for markdown
      const changeDescription = `Renamed node "${flowchart.nodes.find(n => n.id === nodeId)?.id}" to "${newLabel}"`;

      // Update in Supabase and append to markdown
      await updateFlowchartWithDescription(
        currentFlowchartId,
        updatedStructure,
        changeDescription
      );

      // Update local state
      setFlowchart(updatedStructure);

      console.log('✅ Updated node label:', newLabel);
    } catch (err) {
      console.error('❌ Error updating node:', err);
      Alert.alert('Error', 'Failed to update node');
    }
  };

  const handleEdgeEdit = (edge: FlowchartEdge) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to edit relationships');
      return;
    }

    console.log('🔗 Edit relationship:', edge.type, 'from', edge.from, 'to', edge.to);
    // Only show the popup info panel, don't open modal immediately
    // The modal will be opened when the user taps the popup in edit mode
  };

  const handleEdgeEditFromPopup = (edge: FlowchartEdge) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to edit relationships');
      return;
    }

    if (!isEditMode) {
      return; // Only allow editing in edit mode
    }

    console.log('🔗 Opening edge edit modal for:', edge.type, 'from', edge.from, 'to', edge.to);
    setEdgeToEdit(edge);
    setEdgeEditModalVisible(true);
  };

  const handleEdgeUpdate = async (updates: { type: string; label?: string }) => {
    if (!user || !flowchart || !currentFlowchartId || !edgeToEdit) {
      Alert.alert('Error', 'Unable to update relationship');
      return;
    }

    try {
      // Update the edge in the flowchart structure
      const updatedStructure: FlowchartStructure = {
        ...flowchart,
        edges: flowchart.edges.map(edge => 
          edge.from === edgeToEdit.from && edge.to === edgeToEdit.to
            ? { ...edge, type: updates.type as any, label: updates.label }
            : edge
        )
      };

      const fromNode = flowchart.nodes.find(n => n.id === edgeToEdit.from);
      const toNode = flowchart.nodes.find(n => n.id === edgeToEdit.to);
      const changeDescription = `Updated relationship from "${fromNode?.id || edgeToEdit.from}" to "${toNode?.id || edgeToEdit.to}" to type "${updates.type}"${updates.label ? ` with label "${updates.label}"` : ''}`;

      await updateFlowchartWithDescription(
        currentFlowchartId,
        updatedStructure,
        changeDescription
      );

      // Update local state
      setFlowchart(updatedStructure);
      setEdgeEditModalVisible(false);
      setEdgeToEdit(null);

      console.log('✅ Updated relationship:', updates);
    } catch (err) {
      console.error('❌ Error updating relationship:', err);
      Alert.alert('Error', 'Failed to update relationship');
    }
  };

  const handleEdgeDelete = async () => {
    if (!user || !flowchart || !currentFlowchartId || !edgeToEdit) {
      Alert.alert('Error', 'Unable to delete relationship');
      return;
    }

    try {
      // Remove the edge from the flowchart structure
      const updatedStructure: FlowchartStructure = {
        ...flowchart,
        edges: flowchart.edges.filter(edge => 
          !(edge.from === edgeToEdit.from && edge.to === edgeToEdit.to)
        )
      };

      const fromNode = flowchart.nodes.find(n => n.id === edgeToEdit.from);
      const toNode = flowchart.nodes.find(n => n.id === edgeToEdit.to);
      const changeDescription = `Deleted relationship from "${fromNode?.id || edgeToEdit.from}" to "${toNode?.id || edgeToEdit.to}"`;

      await updateFlowchartWithDescription(
        currentFlowchartId,
        updatedStructure,
        changeDescription
      );

      // Update local state
      setFlowchart(updatedStructure);
      setEdgeEditModalVisible(false);
      setEdgeToEdit(null);

      console.log('✅ Deleted relationship');
    } catch (err) {
      console.error('❌ Error deleting relationship:', err);
      Alert.alert('Error', 'Failed to delete relationship');
    }
  };

  const handleGenerateWithAI = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to generate AI flowcharts');
      return;
    }

    Alert.alert(
      'Generate with AI',
      'This will analyze your requirements file and generate a new flowchart structure. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            try {
              setLoading(true);
              setError(null);
              
              const aiStructure = await generateFlowchartFromRequirements(
                flowchart || undefined
              );
              
              if (currentFlowchartId) {
                await updateFlowchartWithDescription(
                  currentFlowchartId,
                  aiStructure,
                  'Generated flowchart structure using AI based on requirements'
                );
              } else {
                const newFlowchart = await createFlowchart(
                  'AI Generated Flowchart',
                  aiStructure,
                  true
                );
                setCurrentFlowchartId(newFlowchart.id);
              }
              
              setFlowchart(aiStructure);
              Alert.alert('Success', 'Flowchart generated successfully!');
              
            } catch (err) {
              console.error('❌ Error generating flowchart:', err);
              Alert.alert('Error', 'Failed to generate flowchart. Please check your API key.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditRequirements = () => {
    router.push('/requirements-editor');
  };

  const handleExportTemplate = async () => {
    if (!flowchart) {
      Alert.alert('No Flowchart', 'There is no flowchart to export.');
      return;
    }

    Alert.alert(
      'Export Template',
      'This will export the current flowchart structure as a JSON template file that can be used as a reference for AI generation.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export',
          onPress: async () => {
            try {
              const templateName = 'empart-flowchart';
              await exportFlowchartAsTemplate(flowchart, templateName);
              Alert.alert('Success', 'Flowchart template exported successfully!');
            } catch (error) {
              console.error('❌ Error exporting template:', error);
              Alert.alert('Error', 'Failed to export template. Please try again.');
            }
          }
        }
      ]
    );
  };


  const handleAddNode = async () => {
    console.log('🔧 handleAddNode called');
    console.log('User:', !!user);
    console.log('Edit mode:', isEditMode);
    console.log('Flowchart:', !!flowchart);
    console.log('Flowchart ID:', currentFlowchartId);
    
    if (!user || !isEditMode || !flowchart || !currentFlowchartId) {
      if (!currentFlowchartId) {
        console.error('❌ No flowchart ID available');
        Alert.alert('Error', 'Unable to add node. Please refresh the page.');
      }
      return;
    }

    // Calculate center position for new node
    const centerX = screenWidth / 2;
    const centerY = screenWidth / 2;

    const newNodeId = `node-${Date.now()}`;
    const newNode: FlowchartNode = {
      id: newNodeId,
      label: 'New Node',
      type: 'manager', // Default type
      x: centerX,
      y: centerY,
      description: 'A new node'
    };

    const updatedStructure: FlowchartStructure = {
      ...flowchart,
      nodes: [...flowchart.nodes, newNode]
    };

    try {
      await updateFlowchartWithDescription(
        currentFlowchartId,
        updatedStructure,
        `Added new node "${newNode.id}" at center position`
      );
      setFlowchart(updatedStructure);
      
      // Immediately prompt to rename the new node
      setTimeout(() => {
        setNodeToRename(newNode);
        setRenameModalVisible(true);
      }, 100);
    } catch (err) {
      console.error('❌ Error adding node:', err);
      Alert.alert('Error', 'Failed to add node');
    }
  };

  const toggleEditMode = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to edit the flowchart');
      return;
    }
    setIsEditMode(!isEditMode);
    // Disable other modes when toggling edit mode
    setIsConnectMode(false);
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedView style={styles.loadingContainer}>
            <ThemedText>Loading flowchart...</ThemedText>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.container}>
          <ThemedView style={styles.errorContainer}>
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </ThemedView>
        </ThemedView>
      </SafeAreaView>
    );
  }

  return (
    <GradientBackground style={styles.container}>
      <GlassHeader>
        <ThemedText type="title" style={styles.titleText}>Body</ThemedText>
        <View style={styles.rightSpacer} />
      </GlassHeader>
      <SafeAreaView style={styles.safeArea} edges={[]}>
        {/* AI Generate Button - Top Right */}
        {user && (
          <Pressable 
            style={styles.aiButton}
            onPress={handleGenerateWithAI}
          >
            <ThemedText style={styles.refreshIcon}>↻</ThemedText>
          </Pressable>
        )}

        {/* Edit Mode Toggle - Bottom Left */}
        {user && (
          <Pressable 
            style={[styles.editModeButton, isEditMode && styles.editModeButtonActive]}
            onPress={toggleEditMode}
          >
            <ThemedText style={styles.editModeIcon}>{isEditMode ? '✓' : '✏️'}</ThemedText>
          </Pressable>
        )}

        {/* Add Node Button - Shows only in edit mode */}
        {user && isEditMode && (
          <Pressable 
            style={styles.addNodeButton}
            onPress={handleAddNode}
          >
            <ThemedText style={styles.addNodeIcon}>+</ThemedText>
          </Pressable>
        )}


        {/* Edit Requirements Button - Top Right */}
        <Pressable 
          style={styles.editButton}
          onPress={handleEditRequirements}
        >
          <ThemedText style={styles.editIcon}>✎</ThemedText>
        </Pressable>
        
        {/* Export Template Button - Top Right (below edit) */}
        {flowchart && (
          <Pressable 
            style={[styles.editButton, { top: 110 }]}
            onPress={handleExportTemplate}
          >
            <ThemedText style={styles.editIcon}>📤</ThemedText>
          </Pressable>
        )}
        
        
        {flowchart && (
          <ThemedView style={styles.flowchartContainer}>
            <FlowchartViewer
              flowchart={flowchart}
              onNodeSelect={handleNodeSelect}
              onNodeEdit={handleNodeEdit}
              onNodeDescriptionEdit={handleNodeDescriptionEdit}
              onNodeMove={handleNodeMove}
              onEdgeEdit={handleEdgeEdit}
              onEdgeEditFromPopup={handleEdgeEditFromPopup}
              onEmptySpaceTap={() => {}}
              width={screenWidth}
              height={screenWidth}
              editable={isEditMode}
              isEditMode={isEditMode}
              isConnectMode={isConnectMode}
              connectingFromNode={connectingFromNode}
            />
          </ThemedView>
        )}
      </SafeAreaView>
      
      {/* Rename Modal */}
      <TextInputModal
        visible={renameModalVisible}
        title="Rename Node"
        placeholder="Enter node name..."
        initialValue={nodeToRename?.id || ''}
        onCancel={handleRenameCancel}
        onSubmit={handleRenameSubmit}
      />
      
      {/* Node Edit Modal */}
      <NodeEditModal
        visible={nodeEditModalVisible}
        node={nodeToEdit}
        onCancel={handleNodeEditCancel}
        onSubmit={handleNodeEditSubmit}
        onConnectMode={handleConnectMode}
        onDelete={handleNodeDelete}
      />
      
      <EdgeEditModal
        visible={edgeEditModalVisible}
        edge={edgeToEdit}
        fromNodeLabel={edgeToEdit ? flowchart?.nodes.find(n => n.id === edgeToEdit.from)?.id : undefined}
        toNodeLabel={edgeToEdit ? flowchart?.nodes.find(n => n.id === edgeToEdit.to)?.id : undefined}
        onCancel={() => {
          setEdgeEditModalVisible(false);
          setEdgeToEdit(null);
        }}
        onSubmit={handleEdgeUpdate}
        onDelete={handleEdgeDelete}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 80, // Account for taller glass header with buttons
  },
  container: {
    flex: 1,
  },
  titleText: {
    flex: 1,
    textAlign: 'left',
    marginLeft: 0, // Remove extra margin since no left spacer
  },
  rightSpacer: {
    width: 40, // Balance the header
  },
  flowchartContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    textAlign: 'center',
    color: '#FF5722',
  },
  aiButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  refreshIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  editButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  editIcon: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  editModeButton: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  editModeButtonActive: {
    backgroundColor: '#FF9500',
  },
  editModeIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addNodeButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addNodeIcon: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    lineHeight: 30,
  },
});