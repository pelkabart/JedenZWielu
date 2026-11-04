export interface SayOptions {
  /** Tempo mowy: 1 = normalne, więcej = szybciej. */
  speed?: number;
}

/** Synteza mowy na żywo; w aplikacji sherpa-onnx (`sherpaVoice`), w testach atrapa. */
export interface Voice {
  /**
   * Mówi zdania po kolei. Obietnica kończy się, gdy padnie ostatnie zdanie albo gdy wypowiedź
   * zostanie przerwana (`stop`). Odrzucenie = błąd syntezy albo odtwarzania.
   */
  say(texts: string[], options?: SayOptions): Promise<void>;
  pause(): void;
  resume(): void;
  /** Przerywa bieżącą wypowiedź. */
  stop(): void;
  /** Zwalnia odtwarzacz; potem nie wolno go używać. */
  dispose(): void;
}
