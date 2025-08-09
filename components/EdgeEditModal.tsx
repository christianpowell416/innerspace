import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FlowchartEdge, RelationshipType, RelationshipStyles } from '@/lib/types/flowchart';

interface EdgeEditModalProps {
  visible: boolean;
  edge: FlowchartEdge | null;
  fromNodeLabel?: string;
  toNodeLabel?: string;
  onCancel: () => void;
  onSubmit: (updates: { type: string; label?: string }) => void;
  onDelete?: () => void;
}

export function EdgeEditModal({
  visible,
  edge,
  fromNodeLabel,
  toNodeLabel,
  onCancel,
  onSubmit,
  onDelete,
}: EdgeEditModalProps) {
  const [type, setType] = useState<string>('alliance');
  const [label, setLabel] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (edge) {
      setType(edge.type);
      setLabel(edge.label || '');
    }
  }, [edge]);

  const handleSubmit = () => {
    const trimmedType = type.trim();
    if (!trimmedType) {
      return; // Don't submit if type is empty
    }
    
    onSubmit({
      type: trimmedType,
      label: label.trim() || undefined,
    });
    resetForm();
  };

  const handleCancel = () => {
    onCancel();
    resetForm();
  };

  const handleDelete = () => {
    onDelete?.();
    resetForm();
  };

  const resetForm = () => {
    if (edge) {
      setType(edge.type);
      setLabel(edge.label || '');
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.centeredView}
      >
        <View style={styles.modalBackdrop}>
          <View style={[
            styles.modalView,
            { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }
          ]}>
            <Text style={[
              styles.modalTitle,
              { color: isDark ? '#FFFFFF' : '#000000' }
            ]}>
              Edit Relationship
            </Text>
            
            <Text style={[
              styles.connectionInfo,
              { color: isDark ? '#8E8E93' : '#666666' }
            ]}>
              {fromNodeLabel || 'Unknown'} → {toNodeLabel || 'Unknown'}
            </Text>
            
            <ScrollView style={styles.formContainer}>
              {/* Relationship Type Input */}
              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  Relationship Type
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      color: isDark ? '#FFFFFF' : '#000000',
                    }
                  ]}
                  placeholder="Enter relationship type (e.g., protection, alliance, conflict)..."
                  placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                  value={type}
                  onChangeText={setType}
                  autoCapitalize="none"
                />
              </View>

              {/* Custom Label Input */}
              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  Custom Label (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      color: isDark ? '#FFFFFF' : '#000000',
                    }
                  ]}
                  placeholder="Enter custom label for this relationship..."
                  placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                  value={label}
                  onChangeText={setLabel}
                />
              </View>
            </ScrollView>
            
            <View style={styles.buttonContainer}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              {onDelete && (
                <Pressable
                  style={[styles.button, styles.deleteButton]}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </Pressable>
              )}
              
              <Pressable
                style={[
                  styles.button,
                  styles.submitButton,
                  !type.trim() && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!type.trim()}
              >
                <Text style={[
                  styles.submitButtonText,
                  !type.trim() && styles.submitButtonTextDisabled
                ]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'Georgia',
  },
  connectionInfo: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Georgia',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: 'Georgia',
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Georgia',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#E5E5EA',
  },
  cancelButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Georgia',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Georgia',
  },
  submitButton: {
    backgroundColor: '#007AFF',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
});