import { useState, useEffect } from 'react';
import { Keyboard, KeyboardEvent, Platform } from 'react-native';

export interface KeyboardInfo {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
}

export function useKeyboardHeight(): KeyboardInfo {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event: KeyboardEvent) => {
        setKeyboardHeight(event.endCoordinates.height);
        setIsKeyboardVisible(true);
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
      }
    );

    // Check initial keyboard state
    const checkInitialKeyboardState = () => {
      if (Platform.OS === 'ios') {
        // On iOS, we can't easily check if keyboard is already shown
        // The listeners will handle the state correctly
        return;
      }

      // On Android, keyboard state is harder to detect initially
      // We rely on the listeners to set the correct state
    };

    checkInitialKeyboardState();

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardVisible,
  };
}