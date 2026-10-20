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
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { androidApi, formatBytes } from '../lib/api';
import { FileItem, FolderItem } from '../types';

export const ExplorerScreen: React.FC = () => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'Root' },
  ]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadFolderContents = async (folderId: string | null) => {
    setLoading(true);
    try {
      const [fList, fileList] = await Promise.all([
        androidApi.listFolders(folderId),
        androidApi.listFiles({ folder_id: folderId }),
      ]);
      setFolders(fList);
      setFiles(fileList);
    } catch (e: any) {
      Alert.alert('Load Error', e.message || 'Failed to list folder contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolderContents(currentFolderId);
  }, [currentFolderId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFolderContents(currentFolderId);
    setRefreshing(false);
  };

  const enterFolder = (f: FolderItem) => {
    setFolderHistory((prev) => [...prev, { id: f.id, name: f.name }]);
    setCurrentFolderId(f.id);
  };

  const navigateBack = (index: number) => {
    const target = folderHistory[index];
    setFolderHistory((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(target.id);
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setActionLoading(true);
        await androidApi.uploadFromDevice(asset.uri, asset.name || 'upload', currentFolderId);
        Alert.alert('Uploaded', `"${asset.name}" stored in folder.`);
        await loadFolderContents(currentFolderId);
      }
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadAndShare = async (file: FileItem) => {
    setActionLoading(true);
    try {
      const localUri = await androidApi.downloadToDevice(file.id, file.original_name);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localUri);
      } else {
        Alert.alert('Downloaded', `Saved to ${localUri}`);
      }
    } catch (e: any) {
      Alert.alert('Download Failed', e.message || 'Could not download file');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteFile = (file: FileItem) => {
    Alert.alert('Delete File', `Move "${file.original_name}" to trash?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await androidApi.updateFile(file.id, { is_deleted: true });
            setFiles((prev) => prev.filter((f) => f.id !== file.id));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleCreateFolderPrompt = () => {
    Alert.prompt
      ? Alert.prompt('New Folder', 'Enter folder name:', async (name) => {
          if (!name || !name.trim()) return;
          try {
            await androidApi.createFolder(name.trim(), currentFolderId);
            await loadFolderContents(currentFolderId);
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to create folder');
          }
        })
      : Alert.alert('New Folder', 'Folder creation is available via Web or top action.');
  };

  return (
    <View style={styles.container}>
      {/* Breadcrumbs Navigation Bar */}
      <View style={styles.breadcrumbBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {folderHistory.map((crumb, idx) => (
            <TouchableOpacity
              key={`${crumb.id || 'root'}_${idx}`}
              onPress={() => navigateBack(idx)}
              style={styles.crumbButton}
            >
              <Text
                style={[
                  styles.crumbText,
                  idx === folderHistory.length - 1 && styles.activeCrumbText,
                ]}
              >
                {crumb.name}
              </Text>
              {idx < folderHistory.length - 1 && <Text style={styles.crumbSeparator}>/</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Main Items View */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0d9488" />
          <Text style={styles.loadingText}>Fetching files from laptop...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollList}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2dd4bf" />}
        >
          {folders.length === 0 && files.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Folder is Empty</Text>
              <Text style={styles.emptyCaption}>Tap + Upload below to add files from this phone.</Text>
            </View>
          ) : (
            <>
              {/* Folders */}
              {folders.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.folderCard}
                  onPress={() => enterFolder(f)}
                >
                  <View style={styles.folderIconBadge}>
                    <Text style={styles.folderIconText}>📁</Text>
                  </View>
                  <Text style={styles.folderName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.chevronText}>›</Text>
                </TouchableOpacity>
              ))}

              {/* Files */}
              {files.map((file) => (
                <View key={file.id} style={styles.fileCard}>
                  <View style={styles.fileIconBadge}>
                    <Text style={styles.fileIconText}>📄</Text>
                  </View>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileTitle} numberOfLines={1}>
                      {file.original_name}
                    </Text>
                    <Text style={styles.fileSubtitle}>
                      {formatBytes(file.size_bytes)} &bull; {file.mime_type}
                    </Text>
                  </View>

                  <View style={styles.fileActions}>
                    <TouchableOpacity
                      onPress={() => handleDownloadAndShare(file)}
                      style={styles.actionBtn}
                      disabled={actionLoading}
                    >
                      <Text style={styles.actionBtnText}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteFile(file)}
                      style={[styles.actionBtn, styles.deleteBtn]}
                    >
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* Floating Upload Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleUpload}
        disabled={actionLoading}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.fabText}>+ Upload</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b14',
  },
  breadcrumbBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  crumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  crumbText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  activeCrumbText: {
    color: '#2dd4bf',
    fontWeight: 'bold',
  },
  crumbSeparator: {
    color: '#475569',
    marginLeft: 6,
    fontSize: 13,
  },
  scrollList: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 90,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
    fontSize: 12,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyCaption: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  folderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  folderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  folderIconText: {
    fontSize: 16,
  },
  folderName: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  chevronText: {
    color: '#64748b',
    fontSize: 20,
    fontWeight: '300',
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  fileIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileIconText: {
    fontSize: 16,
  },
  fileDetails: {
    flex: 1,
    marginRight: 8,
  },
  fileTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '500',
  },
  fileSubtitle: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  fileActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#2dd4bf',
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  deleteBtnText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#0d9488',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
