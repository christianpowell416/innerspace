import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}

export function TextInputModal({
  visible,
  title,
  placeholder = 'Enter text...',
  initialValue = '',
  onCancel,
  onSubmit,
}: TextInputModalProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
      setInputValue('');
    }
  };

  const handleCancel = () => {
    onCancel();
    setInputValue(initialValue);
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
              {title}
            </Text>
            
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                  color: isDark ? '#FFFFFF' : '#000000',
                }
              ]}
              placeholder={placeholder}
              placeholderTextColor={isDark ? '#8E8E93' : '#C7C7CC'}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
              onSubmitEditing={handleSubmit}
            />
            
            <View style={styles.buttonContainer}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.button,
                  styles.submitButton,
                  !inputValue.trim() && styles.submitButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={!inputValue.trim()}
              >
                <Text style={[
                  styles.submitButtonText,
                  !inputValue.trim() && styles.submitButtonTextDisabled
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
    width: '80%',
    maxWidth: 400,
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
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    height: 44,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
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