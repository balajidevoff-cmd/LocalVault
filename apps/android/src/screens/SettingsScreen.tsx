import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export const SettingsScreen: React.FC = () => {
  const { user, serverUrl, updateServerUrl, logout } = useAuth();
  const [serverInput, setServerInput] = useState(serverUrl);
  const [saving, setSaving] = useState(false);

  const handleSaveServer = async () => {
    setSaving(true);
    try {
      const ok = await updateServerUrl(serverInput.trim());
      if (ok) {
        Alert.alert('Saved', 'Server address updated and verified.');
      } else {
        Alert.alert('Unreachable', 'Could not connect to server at that address. Saved, but please check connectivity.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account Profile</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Username</Text>
          <Text style={styles.infoValue}>{user?.username}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Role</Text>
          <Text style={[styles.infoValue, { color: '#2dd4bf', textTransform: 'capitalize' }]}>
            {user?.role}
          </Text>
        </View>
      </View>

      {/* Server Base URL Setting */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Storage Server Connection</Text>
        <Text style={styles.caption}>
          To access your Windows laptop remotely, enter your Tailscale IP (e.g. http://100.X.Y.Z:8000/api/v1) or custom HTTPS domain.
        </Text>

        <TextInput
          style={styles.input}
          value={serverInput}
          onChangeText={setServerInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.100:8000/api/v1"
          placeholderTextColor="#64748b"
        />

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSaveServer}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save & Verify Connection</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Logout button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutBtnText}>Sign Out of LocalVault</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  caption: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  infoValue: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    height: 44,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 13,
    marginBottom: 12,
  },
  saveBtn: {
    height: 44,
    backgroundColor: '#0d9488',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  logoutBtn: {
    height: 48,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  logoutBtnText: {
    color: '#f43f5e',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
