import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  /** Tekst pod polem: podpowiedź albo błąd. */
  hint?: string;
  error?: string | null;
  large?: boolean;
};

/** Pole tekstowe w stylu menu (gruby obrys, ciemny panel). */
export function TextField({ label, hint, error, large = false, style, ...input }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.sky}
        autoCorrect={false}
        {...input}
        style={[styles.input, large && styles.inputLarge, error ? styles.inputError : null, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 320,
    gap: 4,
  },
  label: {
    color: colors.starYellow,
    fontSize: 16,
    fontWeight: '900',
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.outline,
    backgroundColor: colors.panel,
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  inputLarge: {
    height: 60,
    fontSize: 32,
    letterSpacing: 8,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    color: colors.sky,
    fontSize: 12,
    fontWeight: '600',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '800',
  },
});
