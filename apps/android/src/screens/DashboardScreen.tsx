import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../context/AuthContext';
import { androidApi, formatBytes } from '../lib/api';
import { FileItem, StorageUsageResponse } from '../types';

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    try {
      const [u, files] = await Promise.all([
        androidApi.getStorageUsage(),
        androidApi.listFiles({ all_files: true }),
      ]);
      setUsage(u);
      setRecentFiles(files.slice(0, 5));
    } catch (err: any) {
      console.warn('Dashboard load error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handlePickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setUploading(true);
        await androidApi.uploadFromDevice(asset.uri, asset.name || 'mobile_upload');
        Alert.alert('Upload Complete', `"${asset.name}" stored safely on host SSD.`);
        await loadData();
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const usagePercent = usage ? Math.min(100, Math.max(0, usage.user_usage_percentage)) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2dd4bf" />}
    >
      {/* User greeting */}
      <View style={styles.userBanner}>
        <Text style={styles.greeting}>Welcome, {user?.username || 'User'}</Text>
        <Text style={styles.serverHost}>Connected to Host SSD</Text>
      </View>

      {/* Storage Gauge Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Storage Quota</Text>
        <Text style={styles.storageUsageText}>
          {usage ? formatBytes(usage.user_used_bytes) : '...'}
          <Text style={styles.storageLimitText}> / {usage ? formatBytes(usage.user_quota_bytes) : '250 GB'}</Text>
        </Text>

        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${usagePercent}%` }]} />
        </View>

        <View style={styles.storageMetaRow}>
          <Text style={styles.storageMetaText}>{usagePercent}% utilized</Text>
          <Text style={styles.storageMetaText}>
            {usage ? formatBytes(usage.disk_free_bytes) : '...'} physical free
          </Text>
        </View>
      </View>

      {/* Quick Upload Action */}
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={handlePickAndUpload}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadButtonText}>+ Upload File from Phone</Text>
        )}
      </TouchableOpacity>

      {/* Quick Stats Grid */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { marginRight: 8 }]}>
          <Text style={styles.statNumber}>{usage ? usage.file_count : 0}</Text>
          <Text style={styles.statLabel}>Total Files</Text>
        </View>
        <View style={[styles.statBox, { marginLeft: 8 }]}>
          <Text style={styles.statNumber}>{usage ? usage.folder_count : 0}</Text>
          <Text style={styles.statLabel}>Folders</Text>
        </View>
      </View>

      {/* Recent Files */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Files</Text>
        {recentFiles.length === 0 ? (
          <Text style={styles.emptyText}>No files uploaded yet.</Text>
        ) : (
          recentFiles.map((f) => (
            <View key={f.id} style={styles.fileRow}>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {f.original_name}
                </Text>
                <Text style={styles.fileMeta}>{formatBytes(f.size_bytes)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
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
  userBanner: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  serverHost: {
    fontSize: 12,
    color: '#2dd4bf',
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  storageUsageText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 4,
  },
  storageLimitText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: 'normal',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#1e293b',
    borderRadius: 4,
    marginVertical: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0d9488',
    borderRadius: 4,
  },
  storageMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  storageMetaText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  uploadButton: {
    height: 50,
    backgroundColor: '#0d9488',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    marginVertical: 8,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
  },
  fileMeta: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
});
