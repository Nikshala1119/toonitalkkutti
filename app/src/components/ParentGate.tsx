import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

// FR-5.2: parent area behind a math gate a pre-reader can't pass.
// A new multiplication question is generated each time the gate opens.

export function ParentGate({
  visible,
  onPass,
  onCancel,
}: {
  visible: boolean;
  onPass: () => void;
  onCancel: () => void;
}) {
  const [a, b] = useMemo(() => {
    void visible; // regenerate whenever the gate is reopened
    return [3 + Math.floor(Math.random() * 6), 3 + Math.floor(Math.random() * 6)];
  }, [visible]);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (parseInt(answer, 10) === a * b) {
      setAnswer('');
      setWrong(false);
      onPass();
    } else {
      setAnswer('');
      setWrong(true);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Parents only</Text>
          <Text style={styles.subtitle}>பெற்றோருக்கு மட்டும்</Text>
          <Text style={styles.question}>
            {a} × {b} = ?
          </Text>
          <TextInput
            style={[styles.input, wrong && styles.inputWrong]}
            keyboardType="number-pad"
            value={answer}
            onChangeText={(t) => {
              setAnswer(t);
              setWrong(false);
            }}
            onSubmitEditing={submit}
            autoFocus
            maxLength={3}
          />
          {wrong ? <Text style={styles.wrongText}>Try again</Text> : null}
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Back</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={submit}>
              <Text style={styles.btnText}>Enter</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 300,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: '700' },
  subtitle: { fontSize: 14, color: '#666' },
  question: { fontSize: 32, fontWeight: '800', marginTop: 8 },
  input: {
    borderWidth: 2,
    borderColor: '#CCC',
    borderRadius: 12,
    width: 120,
    height: 56,
    fontSize: 26,
    textAlign: 'center',
  },
  inputWrong: { borderColor: '#E53935' },
  wrongText: { color: '#E53935' },
  row: { flexDirection: 'row', gap: 12, marginTop: 12 },
  btn: {
    backgroundColor: '#1E88E5',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { backgroundColor: '#EEE' },
  btnGhostText: { color: '#444', fontSize: 16, fontWeight: '700' },
});
