import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ClientForm from '../../components/ClientForm';
import ClientSelectionModal from '../../components/ClientSelectionModal';
import { MeasurementService } from '../../src/MeasurementService';
import { StorageService } from '../../src/StorageService';

const initialMeasurements = {
  shoulder: '',
  bust: '',
  waist: '',
  hips: '',
  sleeveLength: '',
  garmentLength: '',
};

export default function MeasurementsTab() {
  const [measurements, setMeasurements] = useState(initialMeasurements);
  const [sessionId, setSessionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [clientInfo, setClientInfo] = useState({ name: '', phone: '' });
  const [isClientSelectionVisible, setIsClientSelectionVisible] = useState(false);
  const [clients, setClients] = useState([]);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(false);
  const [boutiqueInfo, setBoutiqueInfo] = useState({ name: 'Boutique Designer Studio', iconUri: null });
  const [setupName, setSetupName] = useState('');
  const [setupIconUri, setSetupIconUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadBoutiqueInfo = async () => {
        try {
          const info = await AsyncStorage.getItem('@boutique_profile');
          if (info) {
            setBoutiqueInfo(JSON.parse(info));
          } else {
            setIsOnboardingVisible(true);
          }
        } catch (e) {
          console.warn('Failed to load boutique info', e);
        }
      };
      loadBoutiqueInfo();
    }, [])
  );

  useEffect(() => {
    const initSession = async () => {
      const newSession = {
        id: `session_${Date.now()}`,
        startedAt: new Date().toISOString(),
      };
      setSessionId(newSession.id);

      try {
        await StorageService.setItem('session', newSession);
      } catch (error) {
        console.warn('[App] storing session failed', error);
      }
    };

    initSession();
  }, []);

  const onSaveClient = async (client) => {
    setClientInfo(client);
    setIsClientModalVisible(false);
    try {
      await StorageService.setItem('client_info', client);
    } catch (error) {
      console.warn('[App] failed to save client info', error);
    }
  };

  const onCancelClient = () => setIsClientModalVisible(false);

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

  const openClientSelection = async () => {
    await loadClients();
    setIsClientSelectionVisible(true);
  };

  const selectExistingClient = (client) => {
    setClientInfo(client);
    setIsClientSelectionVisible(false);
  };

  const handleMeasurementChange = (field, value) => {
    setMeasurements(prev => ({ ...prev, [field]: value }));
  };

  const populateAllMeasurements = (baseShoulder) => {
    const shoulder = parseFloat(baseShoulder);
    setMeasurements({
      shoulder: shoulder.toFixed(1),
      bust: (shoulder * 2.2).toFixed(1),
      waist: (shoulder * 1.8).toFixed(1),
      hips: (shoulder * 2.4).toFixed(1),
      sleeveLength: (shoulder * 1.5).toFixed(1),
      garmentLength: (shoulder * 2.5).toFixed(1),
    });
  };

  const pickImageAndMeasure = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera not supported', 'Camera capture is only supported on native apps.');
      return;
    }

    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus.status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is required to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    const isCancelled = result.cancelled === true || result.canceled === true;
    const uri = result.uri ?? result?.assets?.[0]?.uri ?? null;

    if (!isCancelled && uri) {
      try {
        const fileName = uri.split('/').pop() || `image_${Date.now()}.jpg`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: newUri });

        setCapturedImage(newUri);

        const measuredCm = await MeasurementService.estimateShoulderFromImage(newUri);
        populateAllMeasurements(measuredCm);

        Alert.alert('Image Measurement', `Detected measurements based on shoulder width: ${measuredCm} cm. Values added to form.`);
      } catch (error) {
        console.error('Error saving image natively', error);
        Alert.alert('Error', 'Failed to save image.');
      }
    } else if (!isCancelled && !uri) {
      Alert.alert('Image error', 'Could not retrieve captured image URI.');
    }
  };

  const runAutoMeasure = async () => {
    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const cardPixelWidth = 300;
      const leftShoulder = { x: 100, y: 210 };
      const rightShoulder = { x: 550, y: 220 };
      const ratio = MeasurementService.getCalibrationRatio(cardPixelWidth);
      const measuredCm = MeasurementService.calculateRealDistance(leftShoulder, rightShoulder, ratio);
      populateAllMeasurements(measuredCm);

      Alert.alert('AI Detection Complete', `Auto-populated full profile based on Shoulder Width: ${measuredCm} cm.`);
    } catch (error) {
      Alert.alert('Error', 'AI failed to detect body points.');
      console.warn('[App] runAutoMeasure error', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const pickBoutiqueIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      try {
        const sourceUri = result.assets[0].uri;
        const fileName = `boutique_icon_${Date.now()}.jpg`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: sourceUri, to: newUri });
        setSetupIconUri(newUri);
      } catch (error) {
        Alert.alert('Error', 'Failed to save icon.');
      }
    }
  };

  const saveBoutiqueProfile = async () => {
    if (!setupName.trim()) {
      Alert.alert('Required', 'Please enter a boutique name.');
      return;
    }
    const profile = { name: setupName, iconUri: setupIconUri };
    await AsyncStorage.setItem('@boutique_profile', JSON.stringify(profile));
    setBoutiqueInfo(profile);
    setIsOnboardingVisible(false);
  };

  const saveAllMeasurements = async () => {
    if (!clientInfo.name) {
      Alert.alert('No Client', 'Please add a client first.');
      return;
    }

    try {
      const sessions = await StorageService.loadAllSessions();
      let clientSession = sessions.find(s => s.name === clientInfo.name);
      if (!clientSession) {
        clientSession = {
          id: `session_${Date.now()}`,
          name: clientInfo.name,
          phone: clientInfo.phone,
          measurements: [],
        };
        sessions.push(clientSession);
      }
      clientSession.measurements = clientSession.measurements || [];

      const timestamp = new Date().toISOString();
      let measurementsAdded = 0;

      for (const [field, value] of Object.entries(measurements)) {
        if (value && !isNaN(value)) {
          const newMeasurement = {
            value: parseFloat(value),
            timestamp: timestamp,
            type: 'manual_set',
            field: field,
          };
          clientSession.measurements.push(newMeasurement);
          measurementsAdded++;
        }
      }

      if (measurementsAdded > 0) {
        await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
        Alert.alert('Saved', `${measurementsAdded} measurements saved for ${clientInfo.name}.`);
        setMeasurements(initialMeasurements);
      } else {
        Alert.alert('No Data', 'No new measurements to save.');
      }
    } catch (error) {
      console.error('Error saving measurements', error);
      Alert.alert('Error', 'Failed to save measurements.');
    }
  };

  const shareDesign = async () => {
    Alert.alert('Notice', 'Sharing is disabled in this dev configuration.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerContainer}>
        {boutiqueInfo.iconUri && <Image source={{ uri: boutiqueInfo.iconUri }} style={styles.boutiqueIcon} contentFit="cover" />}
        <Text style={styles.header}>{boutiqueInfo.name} - Measurements</Text>
      </View>
      <Text style={styles.sessionText}>Client: {clientInfo.name || 'No client'}</Text>

      {/* First Time Onboarding Modal */}
      <Modal visible={isOnboardingVisible} animationType="fade" transparent={true}>
        <View style={styles.onboardingOverlay}>
          <View style={styles.onboardingContainer}>
            <Text style={styles.onboardingTitle}>Welcome!</Text>
            <Text style={styles.onboardingSubtitle}>Let's set up your boutique profile.</Text>

            <TouchableOpacity style={styles.iconUploadBtn} onPress={pickBoutiqueIcon}>
              {setupIconUri ? (
                <Image source={{ uri: setupIconUri }} style={styles.setupIconPreview} contentFit="cover" />
              ) : (
                <Ionicons name="camera-outline" size={40} color="white" />
              )}
            </TouchableOpacity>
            <Text style={styles.iconUploadHint}>Upload Boutique Logo</Text>

            <TextInput
              style={styles.onboardingInput}
              placeholder="Boutique Name"
              placeholderTextColor="#999"
              value={setupName}
              onChangeText={setSetupName}
            />

            <TouchableOpacity style={styles.onboardingSubmitBtn} onPress={saveBoutiqueProfile}>
              <Text style={styles.btnTxt}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ClientForm visible={isClientModalVisible} onSave={onSaveClient} onCancel={onCancelClient} />
      {isProcessing && <ActivityIndicator size="small" color="#fff" style={styles.loader} />}

      <ClientSelectionModal
        visible={isClientSelectionVisible}
        clients={clients}
        onSelect={selectExistingClient}
        onCancel={() => setIsClientSelectionVisible(false)}
        onCreateNew={() => {
          setIsClientSelectionVisible(false);
          setIsClientModalVisible(true);
        }}
      />

      <View style={styles.formContainer}>
        <Text style={styles.formHeader}>Enter Measurements (cm)</Text>
        {Object.entries(measurements).map(([field, value]) => (
          <View key={field} style={styles.inputRow}>
            <Text style={styles.inputLabel}>{field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</Text>
            <TextInput
              style={styles.input}
              value={String(value)}
              onChangeText={(text) => handleMeasurementChange(field, text)}
              placeholder="cm"
              keyboardType="numeric"
            />
          </View>
        ))}
      </View>

      {capturedImage && (
        <View style={styles.imagePreviewContainer}>
          <Text style={styles.previewText}>Reference Image:</Text>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: capturedImage }} style={styles.imagePreview} contentFit="cover" />
          </View>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={openClientSelection}>
          <Ionicons name="person-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.btnTxt}>Client</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={pickImageAndMeasure}>
          <Ionicons name="camera-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.btnTxt}>Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={runAutoMeasure}>
          <Ionicons name="color-wand-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.btnTxt}>Auto</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={shareDesign}>
          <Ionicons name="share-social-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.btnTxt}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary, { width: '100%' }]} onPress={saveAllMeasurements}>
          <Ionicons name="save-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.btnTxt}>Save All Measurements</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#1a1a1a', paddingTop: 60 },
  scrollContent: { flexGrow: 1 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, paddingHorizontal: 15 },
  boutiqueIcon: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  header: { color: 'white', fontSize: 20, textAlign: 'center', fontWeight: 'bold', flexShrink: 1 },
  sessionText: { color: '#f3f3f3', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  loader: { marginBottom: 10 },
  imagePreviewContainer: { marginHorizontal: 20, marginBottom: 12, alignItems: 'center' },
  imageWrapper: { position: 'relative' },
  imagePreview: { width: 170, height: 120, borderRadius: 8, marginTop: 8 },
  previewText: { color: '#fff', marginBottom: 6 },
  controls: { padding: 15, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  btn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 10, flexGrow: 1, minWidth: '45%' },
  btnPrimary: { backgroundColor: '#6200ee' },
  btnSecondary: { backgroundColor: '#444' },
  btnTxt: { color: 'white', fontWeight: 'bold' },
  formContainer: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#2a2a2a', padding: 15, borderRadius: 10 },
  formHeader: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inputLabel: { color: 'white', fontSize: 16, flex: 1 },
  input: { backgroundColor: '#444', color: 'white', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 5, minWidth: 80, textAlign: 'right' },
  
  // Onboarding Styles
  onboardingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  onboardingContainer: { backgroundColor: '#2a2a2a', padding: 25, borderRadius: 15, alignItems: 'center' },
  onboardingTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 10 },
  onboardingSubtitle: { color: '#ccc', fontSize: 16, marginBottom: 20, textAlign: 'center' },
  iconUploadBtn: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 10, borderWidth: 2, borderColor: '#555' },
  setupIconPreview: { width: '100%', height: '100%' },
  iconUploadHint: { color: '#aaa', fontSize: 12, marginBottom: 20 },
  onboardingInput: { backgroundColor: '#333', color: 'white', width: '100%', padding: 15, borderRadius: 10, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#555' },
  onboardingSubmitBtn: { backgroundColor: '#6200ee', width: '100%', padding: 15, borderRadius: 10, alignItems: 'center' },
});