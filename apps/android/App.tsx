import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { ExplorerScreen } from './src/screens/ExplorerScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

function MainNavigator() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'files' | 'settings'>('dashboard');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9488" />
        <Text style={styles.loadingSubtext}>Connecting to LocalVault...</Text>
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070b14" />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.brandTitle}>LocalVault</Text>
          <View style={styles.liveIndicator} />
        </View>
        <Text style={styles.headerSubtitle}>
          {currentTab === 'dashboard' ? 'Overview' : currentTab === 'files' ? 'Files' : 'Settings'}
        </Text>
      </View>

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {currentTab === 'dashboard' && <DashboardScreen />}
        {currentTab === 'files' && <ExplorerScreen />}
        {currentTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('dashboard')}
        >
          <Text style={[styles.tabIcon, currentTab === 'dashboard' && styles.tabActiveText]}>
            📊
          </Text>
          <Text style={[styles.tabLabel, currentTab === 'dashboard' && styles.tabActiveText]}>
            Dashboard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('files')}
        >
          <Text style={[styles.tabIcon, currentTab === 'files' && styles.tabActiveText]}>
            📁
          </Text>
          <Text style={[styles.tabLabel, currentTab === 'files' && styles.tabActiveText]}>
            My Files
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setCurrentTab('settings')}
        >
          <Text style={[styles.tabIcon, currentTab === 'settings' && styles.tabActiveText]}>
            ⚙️
          </Text>
          <Text style={[styles.tabLabel, currentTab === 'settings' && styles.tabActiveText]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070b14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingSubtext: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 12,
  },
  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0c1222',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  headerSubtitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  screenContainer: {
    flex: 1,
  },
  bottomTabBar: {
    height: 60,
    backgroundColor: '#0c1222',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 18,
    opacity: 0.6,
  },
  tabLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  tabActiveText: {
    color: '#2dd4bf',
    opacity: 1,
    fontWeight: 'bold',
  },
});
