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
import { FlowchartNode, PartType } from '@/lib/types/flowchart';

interface NodeEditModalProps {
  visible: boolean;
  node: FlowchartNode | null;
  onCancel: () => void;
  onSubmit: (updates: { label: string; type: string; description: string }) => void;
  onConnectMode: () => void;
}


export function NodeEditModal({
  visible,
  node,
  onCancel,
  onSubmit,
  onConnectMode,
}: NodeEditModalProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<string>('manager');
  const [description, setDescription] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (node) {
      setLabel(node.label || node.id || '');
      setType(node.type || 'manager');
      setDescription(node.description || '');
    }
  }, [node]);

  const handleSubmit = () => {
    const trimmedLabel = (label || '').trim();
    if (trimmedLabel) {
      onSubmit({
        label: trimmedLabel,
        type,
        description: (description || '').trim(),
      });
      resetForm();
    }
  };

  const handleCancel = () => {
    onCancel();
    resetForm();
  };

  const resetForm = () => {
    if (node) {
      setLabel(node.label || node.id || '');
      setType(node.type || 'manager');
      setDescription(node.description || '');
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
              Edit Node
            </Text>
            
            <ScrollView style={styles.formContainer}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      color: isDark ? '#FFFFFF' : '#000000',
                    }
                  ]}
                  placeholder="Enter node name..."
                  placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                  value={label}
                  onChangeText={setLabel}
                  autoFocus
                />
              </View>

              {/* Type Input */}
              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  Type
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      color: isDark ? '#FFFFFF' : '#000000',
                    }
                  ]}
                  placeholder="Enter node type..."
                  placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                  value={type}
                  onChangeText={setType}
                />
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={[
                  styles.inputLabel,
                  { color: isDark ? '#FFFFFF' : '#000000' }
                ]}>
                  Description
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textArea,
                    {
                      backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                      color: isDark ? '#FFFFFF' : '#000000',
                    }
                  ]}
                  placeholder="Enter description..."
                  placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
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
              
              <Pressable
                style={[styles.button, styles.connectButton]}
                onPress={onConnectMode}
              >
                <Text style={styles.connectButtonText}>Connect</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.button,
                  styles.submitButton,
                  !(label || '').trim() && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!(label || '').trim()}
              >
                <Text style={[
                  styles.submitButtonText,
                  !(label || '').trim() && styles.submitButtonTextDisabled
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
    marginBottom: 20,
    textAlign: 'center',
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
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '500',
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
  },
  connectButton: {
    backgroundColor: '#FF9500',
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
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
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
});