import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login, register, serverUrl, updateServerUrl, testConnection } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverInput, setServerInput] = useState(serverUrl);
  const [testingServer, setTestingServer] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverConnected, setServerConnected] = useState<boolean | null>(null);

  const handleTestServer = async () => {
    setTestingServer(true);
    setServerConnected(null);
    try {
      const ok = await updateServerUrl(serverInput.trim());
      setServerConnected(ok);
      if (ok) {
        Alert.alert('Connection Successful', `Connected to LocalVault server at:\n${serverInput.trim()}`);
      } else {
        Alert.alert(
          'Connection Failed',
          'Could not reach server. Ensure your phone and laptop are on the same Wi-Fi, or use your private Tailscale address.'
        );
      }
    } catch (e: any) {
      setServerConnected(false);
      Alert.alert('Connection Error', e.message || 'Server check failed');
    } finally {
      setTestingServer(false);
    }
  };

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your username and password.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        if (!email.trim()) {
          Alert.alert('Missing Email', 'Please enter your email address.');
          setSubmitting(false);
          return;
        }
        await register(username.trim(), email.trim(), password);
        Alert.alert('Success', 'Account registered and logged in!');
      } else {
        await login(username.trim(), password);
      }
    } catch (err: any) {
      Alert.alert('Authentication Error', err.message || 'Login failed. Please check credentials or server URL.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>LV</Text>
          </View>
          <Text style={styles.title}>LocalVault</Text>
          <Text style={styles.subtitle}>Self-Hosted Personal Cloud Storage</Text>
        </View>

        {/* Server Address Configuration Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Server Base URL</Text>
          <Text style={styles.caption}>
            Enter laptop LAN IP (e.g. http://192.168.1.50:8000/api/v1) or Tailscale IP. Do not use localhost on real phones.
          </Text>

          <View style={styles.serverRow}>
            <TextInput
              style={styles.serverInput}
              value={serverInput}
              onChangeText={setServerInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://192.168.1.X:8000/api/v1"
              placeholderTextColor="#64748b"
            />
            <TouchableOpacity
              style={styles.testButton}
              onPress={handleTestServer}
              disabled={testingServer}
            >
              {testingServer ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.testButtonText}>Test</Text>
              )}
            </TouchableOpacity>
          </View>

          {serverConnected !== null && (
            <Text style={[styles.statusText, { color: serverConnected ? '#10b981' : '#f43f5e' }]}>
              {serverConnected ? '✓ Server Reachable' : '✗ Unable to connect to host'}
            </Text>
          )}
        </View>

        {/* Credentials Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{isRegister ? 'Register Account' : 'Sign In'}</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="Username"
            placeholderTextColor="#64748b"
          />

          {isRegister && (
            <>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="user@example.com"
                placeholderTextColor="#64748b"
              />
            </>
          )}

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••••••"
            placeholderTextColor="#64748b"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isRegister ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => setIsRegister(!isRegister)}
          >
            <Text style={styles.switchText}>
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  scrollContent: {
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#0d9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  caption: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 16,
  },
  serverRow: {
    flexDirection: 'row',
    gap: 8,
  },
  serverInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 13,
  },
  testButton: {
    backgroundColor: '#0d9488',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  input: {
    height: 46,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#fff',
    fontSize: 14,
  },
  primaryButton: {
    height: 48,
    backgroundColor: '#0d9488',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 14,
    alignItems: 'center',
  },
  switchText: {
    color: '#2dd4bf',
    fontSize: 12,
    fontWeight: '600',
  },
});
