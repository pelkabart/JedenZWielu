import { useEffect, useState } from 'react';

import type { Expression } from '@/skins/catalog';
import { IdleFace } from '@/skins/IdleFace';

/** Mimika postaci w spoczynku. `enabled: false` zatrzymuje ją na otwartych oczach. */
export function useIdleFace(enabled = true, smileChance = 0): Expression {
  const [expression, setExpression] = useState<Expression>('normal');

  useEffect(() => {
    if (!enabled) return;
    const face = new IdleFace({ onChange: setExpression, smileChance });
    face.start();
    return () => {
      face.stop();
      setExpression('normal');
    };
  }, [enabled, smileChance]);

  return expression;
}
