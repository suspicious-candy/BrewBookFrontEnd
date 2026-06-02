import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import { useAuth } from '@/auth/AuthContext';

/**
 * Create-account screen. Validates the form against the User schema limits
 * (name/email lengths, 10–50 char password, matching confirmation), calls signUp
 * with name metadata, and returns to Login on success.
 */
export default function BrewLedgerCreateAccount() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Update one field and clear any error / server error tied to it.
  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    if (serverError) setServerError(null);
  };

  // Client-side validation mirroring the User schema constraints. Returns true if valid.
  const validate = () => {
    const next = {};

    if (!form.firstName.trim()) next.firstName = 'Required';
    else if (form.firstName.trim().length < 2) next.firstName = 'Min 2 characters';
    else if (form.firstName.trim().length > 30) next.firstName = 'Max 30 characters';

    if (!form.lastName.trim()) next.lastName = 'Required';
    else if (form.lastName.trim().length < 2) next.lastName = 'Min 2 characters';
    else if (form.lastName.trim().length > 30) next.lastName = 'Max 30 characters';

    if (!form.email.trim()) next.email = 'Required';
    else if (form.email.trim().length > 50) next.email = 'Max 50 characters';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Invalid email';

    if (!form.password) next.password = 'Required';
    else if (form.password.length < 10) next.password = 'Min 10 characters';
    else if (form.password.length > 50) next.password = 'Max 50 characters';

    if (form.password !== form.confirmPassword) next.confirmPassword = 'Codes do not match';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Validate, call signUp, then route to Login; map email errors back to the field.
  const handleCreate = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    try {
      const { error } = await signUp(form.email.trim().toLowerCase(), form.password, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
      });

      if (error) {
        if (/email/i.test(error)) {
          setErrors(prev => ({ ...prev, email: error }));
        } else {
          setServerError(error);
        }
        return;
      }

      router.replace('/Login/Login');
    } catch (err) {
      setServerError(err?.message ?? 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.brandName}>The Brew Ledger</Text>
              <Text style={styles.tagline}>NEW OPERATOR REGISTRATION</Text>
            </View>

            <View style={styles.divider} />

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Field
                    label="FIRST NAME"
                    placeholder="Jane"
                    value={form.firstName}
                    onChangeText={v => update('firstName', v)}
                    error={errors.firstName}
                    autoCapitalize="words"
                    maxLength={30}
                  />
                </View>
                <View style={styles.rowGap} />
                <View style={styles.rowItem}>
                  <Field
                    label="LAST NAME"
                    placeholder="Brewster"
                    value={form.lastName}
                    onChangeText={v => update('lastName', v)}
                    error={errors.lastName}
                    autoCapitalize="words"
                    maxLength={30}
                  />
                </View>
              </View>

              <Field
                label="OPERATOR EMAIL"
                placeholder="name@roastery.com"
                value={form.email}
                onChangeText={v => update('email', v)}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={50}
              />

              <Field
                label="ACCESS CODE"
                placeholder="••••••••••"
                value={form.password}
                onChangeText={v => update('password', v)}
                error={errors.password}
                secureTextEntry
                maxLength={50}
                hint="10–50 characters"
              />

              <Field
                label="CONFIRM ACCESS CODE"
                placeholder="••••••••••"
                value={form.confirmPassword}
                onChangeText={v => update('confirmPassword', v)}
                error={errors.confirmPassword}
                secureTextEntry
                maxLength={50}
              />

              {serverError ? (
                <View style={styles.serverErrorBox}>
                  <Text style={styles.serverErrorText}>! {serverError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                onPress={handleCreate}
                activeOpacity={0.85}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#f0e8dc" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>CREATE ACCOUNT</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.termsText}>
                By registering you join as a{' '}
                <Text style={styles.termsHighlight}>Bean Sprout</Text>. Brew responsibly.
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.replace('/Login/Login')}>
                <Text style={styles.footerLink}>Back to{'\n'}Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Labeled text input with inline error-or-hint text. Used for every field on the
 * create-account form.
 */
function Field({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  hint,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, error && fieldStyles.inputError]}
        placeholder={placeholder}
        placeholderTextColor="#b0a898"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
      />
      {error ? (
        <Text style={fieldStyles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={fieldStyles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#4a3f32',
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f5efe6',
    borderWidth: 1,
    borderColor: '#c9bfb0',
    borderRadius: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#2c2218',
  },
  inputError: {
    borderColor: '#8b4a3a',
  },
  errorText: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#8b4a3a',
    letterSpacing: 1,
  },
  hintText: {
    marginTop: 4,
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#8a7d6e',
    letterSpacing: 1,
  },
});

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#1c1b19',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  card: {
    width: 280,
    backgroundColor: '#ede5d8',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c9bfb0',
  },

  // Header
  header: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#e8dfd1',
  },
  brandName: {
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#2c2218',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#6b5e4e',
    letterSpacing: 2,
  },

  divider: {
    height: 1,
    backgroundColor: '#c9bfb0',
  },

  // Form
  form: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  row: {
    flexDirection: 'row',
  },
  rowItem: {
    flex: 1,
  },
  rowGap: {
    width: 10,
  },
  serverErrorBox: {
    backgroundColor: '#f3e2dc',
    borderWidth: 1,
    borderColor: '#8b4a3a',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    borderRadius: 2,
  },
  serverErrorText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#6b2f24',
    letterSpacing: 0.5,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#1e1208',
    borderRadius: 2,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#f0e8dc',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2.5,
    fontWeight: '600',
  },
  termsText: {
    marginTop: 14,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#8a7d6e',
    textAlign: 'center',
    lineHeight: 15,
  },
  termsHighlight: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#4a3f32',
    letterSpacing: 1,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#e8dfd1',
  },
  footerLink: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#4a3f32',
    lineHeight: 17,
  },
});