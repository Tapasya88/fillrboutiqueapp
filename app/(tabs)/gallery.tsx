import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { StorageService } from '../../src/StorageService';

export default function GalleryTab() {
  const [designs, setDesigns] = useState([]);
  const [isDesignViewerVisible, setIsDesignViewerVisible] = useState(false);
  const [selectedDesignForView, setSelectedDesignForView] = useState(null);
  const [isClientSelectionVisible, setIsClientSelectionVisible] = useState(false);
  const [clients, setClients] = useState([]);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [boutiqueInfo, setBoutiqueInfo] = useState({ name: 'Boutique Designer Studio', iconUri: null });

  useFocusEffect(
    useCallback(() => {
      const loadBoutiqueInfo = async () => {
        try {
          const info = await AsyncStorage.getItem('@boutique_profile');
          if (info) {
            setBoutiqueInfo(JSON.parse(info));
          }
        } catch (e) {}
      };
      loadBoutiqueInfo();
      loadDesigns();
    }, [])
  );

  const loadDesigns = async () => {
    try {
      const sessions = await StorageService.loadAllSessions();
      const allDesigns = sessions.flatMap(session => 
        (session.designs || []).map(design => ({ ...design, clientName: session.name }))
      );
      setDesigns(allDesigns);
    } catch (error) {
      console.error('Error loading designs', error);
    }
  };

  const deleteDesign = async (designId) => {
    Alert.alert('Delete Design', 'Are you sure you want to delete this design?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: async () => {
        try {
          const sessions = await StorageService.loadAllSessions();
          sessions.forEach(session => {
            if (session.designs) {
              session.designs = session.designs.filter(d => d.id !== designId);
            }
          });
          await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
          loadDesigns();
        } catch (error) {
          console.error('Error deleting design', error);
        }
      }},
    ]);
  };

  const loadClients = async () => {
    try {
      const sessions = await StorageService.loadAllSessions();
      const uniqueClients = sessions.reduce((acc, session) => {
        if (!acc.find(c => c.name === session.name)) {
          const profileImg = (session.measurements || []).find(m => m.imageUri)?.imageUri;
          acc.push({ 
            name: session.name, 
            phone: session.phone, 
            id: session.id,
            gender: session.gender,
            imageUri: session.imageUri || profileImg || null
          });
        }
        return acc;
      }, []);
      setClients(uniqueClients);
    } catch (error) {
      console.error('Error loading clients', error);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission to access gallery is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      try {
        const sourceUri = result.assets[0].uri;
        const fileName = sourceUri.split('/').pop() || `image_${Date.now()}.jpg`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: sourceUri, to: newUri });
        
        setPendingImageUri(newUri);
        await loadClients();
        setIsClientSelectionVisible(true);
      } catch (error) {
        console.error('Error saving image natively', error);
        Alert.alert('Error', 'Failed to save image.');
      }
    }
  };

  const saveImageToClient = async (client) => {
    if (!pendingImageUri) return;
    try {
      const sessions = await StorageService.loadAllSessions();
      const clientSession = sessions.find(s => s.id === client.id);
      if (clientSession) {
        clientSession.designs = clientSession.designs || [];
        clientSession.designs.push({
          id: `design_${Date.now()}`,
          imageUri: pendingImageUri,
          savedAt: new Date().toISOString(),
        });
        await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
        Alert.alert('Success', 'Image saved to client gallery.');
        setIsClientSelectionVisible(false);
        setPendingImageUri(null);
        loadDesigns();
      }
    } catch (error) {
      console.error('Error saving image', error);
      Alert.alert('Error', 'Failed to save image.');
    }
  };

  const renderDesign = ({ item }) => (
    <TouchableOpacity style={styles.designItem} onPress={() => {
      setSelectedDesignForView(item);
      setIsDesignViewerVisible(true);
    }}>
      <View style={styles.designInfo}>
        <Text style={styles.clientName}>{item.clientName}</Text>
        <Text style={styles.designDate}>Saved: {new Date(item.savedAt).toLocaleDateString()}</Text>
      </View>
      <View style={styles.designCanvas}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Svg height="100%" width="100%" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
            {item.paths?.map((pathData, index) => {
              const isString = typeof pathData === 'string';
              const d = isString ? pathData : pathData.d;
              const strokeColor = isString ? (item.color || 'black') : (pathData.color || 'black');
              return (
                <Path
                  key={index}
                  d={d}
                  stroke={strokeColor}
                  strokeWidth="10"
                  fill="none"
                />
              );
            })}
          </Svg>
        )}
      </View>
      <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteDesign(item.id)}>
        <Text style={styles.deleteTxt}>Delete</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          {boutiqueInfo.iconUri && <Image source={{ uri: boutiqueInfo.iconUri }} style={styles.boutiqueIcon} contentFit="cover" />}
          <Text style={styles.header}>{boutiqueInfo.name} - Gallery</Text>
        </View>
        <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
          <Ionicons name="cloud-upload-outline" size={20} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.uploadBtnTxt}>Upload Reference Image</Text>
        </TouchableOpacity>
        {designs.length === 0 ? (
          <Text style={styles.empty}>No designs saved yet.</Text>
        ) : (
          <FlatList
            data={designs}
            keyExtractor={(item) => item.id}
            renderItem={renderDesign}
          />
        )}
      </View>

      {selectedDesignForView && (
        <Modal visible={isDesignViewerVisible} animationType="slide" onRequestClose={() => setIsDesignViewerVisible(false)}>
          <View style={styles.designViewerContainer}>
            <Text style={styles.designViewerHeader}>Design Details</Text>
            <Text style={styles.designViewerClient}>Client: {selectedDesignForView.clientName}</Text>
            <Text style={styles.designViewerDate}>Saved: {new Date(selectedDesignForView.savedAt).toLocaleDateString()}</Text>
            <View style={styles.fullDesignCanvas}>
              {selectedDesignForView.imageUri ? (
                <Image source={{ uri: selectedDesignForView.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
              ) : (
                <Svg height="100%" width="100%" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
                  {selectedDesignForView.paths?.map((pathData, index) => {
                    const isString = typeof pathData === 'string';
                    const d = isString ? pathData : pathData.d;
                    const strokeColor = isString ? (selectedDesignForView.color || 'black') : (pathData.color || 'black');
                    return (
                      <Path
                        key={index}
                        d={d}
                        stroke={strokeColor}
                        strokeWidth="10"
                        fill="none"
                      />
                    );
                  })}
                </Svg>
              )}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsDesignViewerVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButtonModal} onPress={() => {
              deleteDesign(selectedDesignForView.id);
              setIsDesignViewerVisible(false);
            }}>
              <Text style={styles.deleteButtonModalText}>Delete Design</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#1a1a1a' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, paddingHorizontal: 15 },
  boutiqueIcon: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  header: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center', flexShrink: 1 },
  empty: { fontSize: 16, textAlign: 'center', marginTop: 50, color: '#ccc' },
  designItem: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  designInfo: { flex: 1, marginRight: 10 },
  clientName: { fontSize: 16, fontWeight: 'bold', marginBottom: 5, color: 'white' },
  designDate: { fontSize: 12, color: '#ccc', marginBottom: 5 },
  designCanvas: { width: 80, height: 80, backgroundColor: '#fff', borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: '#444', marginRight: 10 },
  deleteBtn: { backgroundColor: '#ff4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
  deleteTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  // Styles for the design viewer modal
  designViewerContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a', // Dark background for the modal
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  designViewerHeader: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10 },
  designViewerClient: { fontSize: 18, color: '#ccc', marginBottom: 5 },
  designViewerDate: { fontSize: 16, color: '#ccc', marginBottom: 20 },
  fullDesignCanvas: {
    width: '90%', // Take up most of the modal width
    height: '60%', // Take up most of the modal height
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  closeButton: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, marginTop: 20 },
  closeButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  deleteButtonModal: { backgroundColor: '#ff4444', padding: 15, borderRadius: 10, marginTop: 10 },
  deleteButtonModalText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  uploadBtn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  uploadBtnTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});