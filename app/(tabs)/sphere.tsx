import React, { useState, useEffect } from 'react';
import { StyleSheet, Dimensions, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FlowchartViewer } from '@/components/FlowchartViewer';
import { FlowchartStructure, FlowchartNode, FlowchartEdge } from '@/lib/types/flowchart';
import { 
  getUserFlowchart, 
  updateFlowchartWithDescription,
  subscribeToFlowchartChanges,
  FlowchartRow,
  generateFlowchartFromRequirements,
  createFlowchart
} from '@/lib/services/flowcharts';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/useColorScheme';

const { width: screenWidth } = Dimensions.get('window');

export default function SphereScreen() {
  const { user } = useAuth();
  const [flowchart, setFlowchart] = useState<FlowchartStructure | null>(null);
  const [currentFlowchartId, setCurrentFlowchartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load flowchart on component mount
  useEffect(() => {
    loadFlowchart();
  }, [user]);

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
      
      const structure = await getUserFlowchart();
      setFlowchart(structure);
      
      // If user is authenticated, get the flowchart ID for updates
      if (user) {
        // This is a simplified approach - in real implementation,
        // getUserFlowchart should return both structure and ID
        console.log('✅ Loaded flowchart structure');
      }
    } catch (err) {
      console.error('❌ Error loading flowchart:', err);
      setError('Failed to load flowchart');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeSelect = (node: FlowchartNode) => {
    console.log('📍 Selected node:', node.label, '(', node.type, ')');
  };

  const handleNodeEdit = (node: FlowchartNode) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to edit the flowchart');
      return;
    }

    // Show simple edit dialog (in real implementation, use a proper modal)
    Alert.alert(
      'Edit Node',
      `Edit "${node.label}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Rename',
          onPress: () => promptForNodeRename(node)
        }
      ]
    );
  };

  const promptForNodeRename = (node: FlowchartNode) => {
    // In a real implementation, this would use a proper text input modal
    // For now, we'll just demonstrate the concept
    Alert.prompt(
      'Rename Node',
      'Enter new name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (newName) => {
            if (newName && flowchart && currentFlowchartId) {
              updateNodeLabel(node.id, newName);
            }
          }
        }
      ],
      'plain-text',
      node.label
    );
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
      const changeDescription = `Renamed node "${flowchart.nodes.find(n => n.id === nodeId)?.label}" to "${newLabel}"`;

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
    // TODO: Implement edge editing modal
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
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <ThemedView style={styles.container}>
        {/* AI Generate Button - Top Left */}
        {user && (
          <Pressable 
            style={styles.aiButton}
            onPress={handleGenerateWithAI}
          >
            <ThemedText style={styles.refreshIcon}>↻</ThemedText>
          </Pressable>
        )}
        
        {flowchart && (
          <ThemedView style={styles.flowchartContainer}>
            <FlowchartViewer
              flowchart={flowchart}
              onNodeSelect={handleNodeSelect}
              onNodeEdit={handleNodeEdit}
              onEdgeEdit={handleEdgeEdit}
              width={screenWidth}
              height={screenWidth}
              editable={!!user}
            />
          </ThemedView>
        )}
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
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
});