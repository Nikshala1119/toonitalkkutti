import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createChildProfile,
  ensureFamily,
  signInParent,
  signUpParent,
} from '../data/auth';
import { supabase } from '../data/supabase';
import { assignChildToQueued, syncAttempts } from '../state/attemptQueue';
import { useAppStore } from '../state/appStore';

// Parent-facing first-run flow (NFR-4): account → consent → child profile.
// Steps: welcome → account (sign up / sign in / local-only) → consent →
// child profile → done. Consent is recorded before any child use; camera
// consent is separate and revocable from the parent area.

type Step = 'welcome' | 'account' | 'confirmEmail' | 'consent' | 'child';

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(false);

  const [parentLanguage, setParentLanguage] = useState<'ta' | 'en'>('ta');
  const [dataConsent, setDataConsent] = useState(false);
  const [cameraConsent, setCameraConsent] = useState(true);

  const [nickname, setNickname] = useState('');
  const [band, setBand] = useState<'4-5' | '6-7'>('4-5');

  const completeOnboarding = useAppStore((s) => s.completeOnboarding);

  const submitAccount = async () => {
    setBusy(true);
    setError(null);
    const fn = mode === 'signup' ? signUpParent : signInParent;
    const result = await fn(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      setError(result.message === 'offline' ? 'No connection — try "Skip for now".' : result.message);
      return;
    }
    setStep(result.needsEmailConfirm ? 'confirmEmail' : 'consent');
  };

  const checkConfirmed = async () => {
    setBusy(true);
    setError(null);
    const result = await signInParent(email.trim(), password);
    setBusy(false);
    if (result.ok) setStep('consent');
    else setError('Not confirmed yet — tap the link in your email first.');
  };

  const submitConsent = () => {
    if (!dataConsent) {
      setError('Consent is required to continue.');
      return;
    }
    setError(null);
    setStep('child');
  };

  const submitChild = async () => {
    const name = nickname.trim();
    if (!name) {
      setError('Please enter a nickname.');
      return;
    }
    setBusy(true);
    setError(null);

    let familyId: string | null = null;
    let childId: string | null = null;
    if (!localOnly && supabase) {
      familyId = await ensureFamily({ parentLanguage, cameraConsent });
      if (familyId) {
        childId = await createChildProfile({
          familyId,
          nickname: name,
          birthYearBand: band,
          cameraEnabled: cameraConsent,
        });
      }
      if (childId) {
        await assignChildToQueued(childId);
        syncAttempts().catch(() => undefined);
      }
    }

    completeOnboarding({
      nickname: name,
      cameraEnabled: cameraConsent,
      serverFamilyId: familyId,
      serverChildId: childId,
    });
    setBusy(false);
    onDone();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {step === 'welcome' ? (
          <View style={styles.card}>
            <Text style={styles.logo}>🐵</Text>
            <Text style={styles.title}>ToonTalk</Text>
            <Text style={styles.body}>
              வணக்கம்! Kutti உங்கள் குழந்தைக்கு English சொல்லிக் கொடுக்கும்.
            </Text>
            <Text style={styles.bodyDim}>
              A parent sets things up first — it takes one minute.
            </Text>
            <Pressable style={styles.btn} onPress={() => setStep('account')}>
              <Text style={styles.btnText}>Get started</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'account' ? (
          <View style={styles.card}>
            <Text style={styles.title}>
              {mode === 'signup' ? 'Create parent account' : 'Sign in'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (6+ characters)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.btn} onPress={submitAccount} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {mode === 'signup' ? 'Sign up' : 'Sign in'}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
              <Text style={styles.link}>
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setLocalOnly(true);
                setStep('consent');
              }}
            >
              <Text style={styles.linkDim}>
                Skip for now (works offline, no parent dashboard)
              </Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'confirmEmail' ? (
          <View style={styles.card}>
            <Text style={styles.logo}>📧</Text>
            <Text style={styles.title}>Confirm your email</Text>
            <Text style={styles.bodyDim}>
              We sent a link to {email.trim()}. Tap it, then come back here.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.btn} onPress={checkConfirmed} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>I confirmed it</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {step === 'consent' ? (
          <View style={styles.card}>
            <Text style={styles.title}>Parental consent</Text>
            <View style={styles.consentRow}>
              <Switch value={dataConsent} onValueChange={setDataConsent} />
              <Text style={styles.consentText}>
                I am the parent/guardian and consent to my child using ToonTalk.
                Activity results are stored to track learning progress. No
                video or audio is ever recorded.
              </Text>
            </View>
            <View style={styles.consentRow}>
              <Switch value={cameraConsent} onValueChange={setCameraConsent} />
              <Text style={styles.consentText}>
                Allow camera activities (finger counting, color hunt). All
                processing happens on this device. You can turn this off any
                time in the parent area.
              </Text>
            </View>
            <View style={styles.consentRow}>
              <Text style={styles.consentText}>Dashboard language:</Text>
              <Pressable
                style={[styles.chip, parentLanguage === 'ta' && styles.chipOn]}
                onPress={() => setParentLanguage('ta')}
              >
                <Text>தமிழ்</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, parentLanguage === 'en' && styles.chipOn]}
                onPress={() => setParentLanguage('en')}
              >
                <Text>English</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.btn} onPress={submitConsent}>
              <Text style={styles.btnText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'child' ? (
          <View style={styles.card}>
            <Text style={styles.title}>Who's learning?</Text>
            <TextInput
              style={styles.input}
              placeholder="Child's nickname"
              value={nickname}
              onChangeText={setNickname}
              maxLength={30}
            />
            <View style={styles.rowCenter}>
              <Pressable
                style={[styles.chip, band === '4-5' && styles.chipOn]}
                onPress={() => setBand('4-5')}
              >
                <Text>Age 4–5</Text>
              </Pressable>
              <Pressable
                style={[styles.chip, band === '6-7' && styles.chipOn]}
                onPress={() => setBand('6-7')}
              >
                <Text>Age 6–7</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.btn} onPress={submitChild} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Start learning! 🎉</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E3F6FF' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  logo: { fontSize: 56 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E5AA8' },
  body: { fontSize: 16, textAlign: 'center' },
  bodyDim: { fontSize: 14, color: '#666', textAlign: 'center' },
  input: {
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 12,
    width: '100%',
    height: 52,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  btn: {
    backgroundColor: '#FF7043',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  link: { color: '#1E88E5', fontSize: 14 },
  linkDim: { color: '#999', fontSize: 13 },
  error: { color: '#E53935', textAlign: 'center' },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  consentText: { flex: 1, fontSize: 14, lineHeight: 20 },
  rowCenter: { flexDirection: 'row', gap: 12 },
  chip: {
    borderWidth: 2,
    borderColor: '#DDD',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipOn: { borderColor: '#FF7043', backgroundColor: '#FFF3E0' },
});
