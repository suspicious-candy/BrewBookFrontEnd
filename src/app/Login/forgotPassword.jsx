import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useHrefAttrs } from 'expo-router/build/link/useLinkHooks';

export default function BrewLedgerForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleReset = () => {
    if (email.trim()) setSubmitted(true);
  };

  return (
    <SafeAreaView style={styles.outerContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.brandName}>The Brew Ledger</Text>
            <Text style={styles.tagline}>PASSWORD RECOVERY</Text>
          </View>

          <View style={styles.divider} />

          {/* Form */}
          <View style={styles.form}>
            {!submitted ? (
              <>
                <Text style={styles.instructionText}>
                  Enter your registered operator email. A recovery link will be dispatched shortly.
                </Text>

                <Text style={styles.label}>OPERATOR EMAIL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@roastery.com"
                  placeholderTextColor="#b0a898"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleReset}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>SEND RECOVERY LINK</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.confirmationBox}>
                <Text style={styles.confirmationTitle}>LINK DISPATCHED</Text>
                <Text style={styles.confirmationText}>
                  Check your inbox at{'\n'}
                  <Text style={styles.confirmationEmail}>{email}</Text>
                  {'\n\n'}Follow the link to reset your access code.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.dismissTo('/Login/Login')}>
              <Text style={styles.footerLink}>Back to{'\n'}Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/Login/createAccount')}>
              <Text style={styles.footerLink}>Create{'\n'}Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#1c1b19',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
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
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#6b5e4e',
    letterSpacing: 2.5,
  },

  divider: {
    height: 1,
    backgroundColor: '#c9bfb0',
  },

  // Form
  form: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  instructionText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#6b5e4e',
    lineHeight: 17,
    marginBottom: 20,
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
  primaryButton: {
    marginTop: 24,
    backgroundColor: '#1e1208',
    borderRadius: 2,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#f0e8dc',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 2.5,
    fontWeight: '600',
  },

  // Confirmation state
  confirmationBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  confirmationTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#4a3f32',
    letterSpacing: 3,
    marginBottom: 14,
  },
  confirmationText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: '#6b5e4e',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmationEmail: {
    color: '#2c2218',
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 11,
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