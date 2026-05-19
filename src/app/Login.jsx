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
} from 'react-native';

export default function BrewLedgerLogin() {
  const [email, setEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');

  const handleLogin = () => {
    // handle login logic
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
            <Text style={styles.tagline}>AUTHORIZED ACCESS LOG</Text>
          </View>

          <View style={styles.divider} />

          {/* Form */}
          <View style={styles.form}>
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

            <Text style={[styles.label, styles.labelSpacing]}>ACCESS CODE</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#b0a898"
              value={accessCode}
              onChangeText={setAccessCode}
              secureTextEntry
            />

            <TouchableOpacity style={styles.loginButton} onPress={handleLogin} activeOpacity={0.85}>
              <Text style={styles.loginButtonText}>LOGIN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Forgot{'\n'}Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity>
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
  label: {
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    color: '#4a3f32',
    letterSpacing: 2,
    marginBottom: 8,
  },
  labelSpacing: {
    marginTop: 18,
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
  loginButton: {
    marginTop: 24,
    backgroundColor: '#1e1208',
    borderRadius: 2,
    paddingVertical: 14,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#f0e8dc',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    letterSpacing: 3,
    fontWeight: '600',
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