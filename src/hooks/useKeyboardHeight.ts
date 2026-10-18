import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

import { createLogger } from '@/lib/log';

const log = createLogger('klawiatura');

/** Wysokość otwartej klawiatury ekranowej (0, gdy jest schowana). */
export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // Android wysyła tylko zdarzenia "Did", iOS ma też "Will" (wcześniejsze, płynniejsze).
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      log.debug('Klawiatura otwarta', { height: e.endCoordinates.height });
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      log.debug('Klawiatura schowana');
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
