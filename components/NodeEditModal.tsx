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
  onSubmit: (updates: { id: string; type: string; description: string; transcripts: string[] }) => void;
  onConnectMode: () => void;
  onDelete?: () => void;
}


export function NodeEditModal({
  visible,
  node,
  onCancel,
  onSubmit,
  onConnectMode,
  onDelete,
}: NodeEditModalProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<string>('manager');
  const [description, setDescription] = useState('');
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    if (node) {
      setLabel(node.id || '');
      setType(node.type || 'manager');
      setDescription(node.description || '');
      setTranscripts(node.transcripts || []);
    }
  }, [node]);

  const handleSubmit = () => {
    const trimmedLabel = (label || '').trim();
    if (trimmedLabel) {
      onSubmit({
        id: trimmedLabel,
        type,
        description: (description || '').trim(),
        transcripts: transcripts,
      });
      resetForm();
    }
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
    if (node) {
      setLabel(node.id || '');
      setType(node.type || 'manager');
      setDescription(node.description || '');
      setTranscripts(node.transcripts || []);
    }
  };

  const addTranscript = () => {
    setTranscripts([...transcripts, '']);
  };

  const updateTranscript = (index: number, value: string) => {
    const updated = [...transcripts];
    updated[index] = value;
    setTranscripts(updated);
  };

  const removeTranscript = (index: number) => {
    const updated = transcripts.filter((_, i) => i !== index);
    setTranscripts(updated);
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

              {/* Transcripts Section */}
              <View style={styles.inputGroup}>
                <View style={styles.transcriptsHeader}>
                  <Text style={[
                    styles.inputLabel,
                    { color: isDark ? '#FFFFFF' : '#000000' }
                  ]}>
                    AI Conversation Transcripts
                  </Text>
                  <Pressable
                    style={[styles.addButton, { backgroundColor: isDark ? '#007AFF' : '#007AFF' }]}
                    onPress={addTranscript}
                  >
                    <Text style={styles.addButtonText}>+ Add</Text>
                  </Pressable>
                </View>
                
                {transcripts.map((transcript, index) => (
                  <View key={index} style={styles.transcriptItem}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.textArea,
                        {
                          backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                          color: isDark ? '#FFFFFF' : '#000000',
                          flex: 1,
                        }
                      ]}
                      placeholder={`Transcript ${index + 1}...`}
                      placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
                      value={transcript}
                      onChangeText={(value) => updateTranscript(index, value)}
                      multiline
                      numberOfLines={4}
                    />
                    <Pressable
                      style={[styles.removeButton, { backgroundColor: '#FF3B30' }]}
                      onPress={() => removeTranscript(index)}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </Pressable>
                  </View>
                ))}
                
                {transcripts.length === 0 && (
                  <Text style={[
                    styles.noTranscriptsText,
                    { color: isDark ? '#8E8E93' : '#C7C7CC' }
                  ]}>
                    No transcripts yet. Add one to document AI conversations about this node.
                  </Text>
                )}
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
  connectButton: {
    backgroundColor: '#FF9500',
  },
  connectButtonText: {
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
  transcriptsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Georgia',
  },
  transcriptItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 18,
    fontFamily: 'Georgia',
  },
  noTranscriptsText: {
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 14,
    fontFamily: 'Georgia',
  },
});