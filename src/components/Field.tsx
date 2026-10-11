import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '../theme';

/** Text input styled as a recessed glass well, so it reads as "inside" a GlassCard. */
export default function Field(props: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.well, focused && styles.wellFocused]}>
      <LinearGradient colors={['#E4F2FA', '#FFFFFF', '#FFFFFF']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[styles.input, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  well: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#BFDDEC',
    overflow: 'hidden',
  },
  wellFocused: { borderColor: colors.aquaDeep },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.semi,
    fontSize: 16,
    color: colors.navy,
  },
});
