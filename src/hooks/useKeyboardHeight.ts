import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** Wysokość otwartej klawiatury ekranowej (0, gdy jest schowana). */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // Android wysyła tylko zdarzenia "Did", iOS ma też "Will" (wcześniejsze, płynniejsze).
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
