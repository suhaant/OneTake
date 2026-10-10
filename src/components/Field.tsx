import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, fonts } from '../theme';

/** Text input styled to sit on a GlassCard. */
export default function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

const styles = StyleSheet.create({
  input: {
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#CFE8F6',
    fontFamily: fonts.semi,
    fontSize: 16,
    color: colors.navy,
  },
});
