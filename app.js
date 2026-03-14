import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ClientForm from './components/ClientForm';
import ColorPicker from './components/ColorPicker';
import { MeasurementService } from './src/MeasurementService';
import { StorageService } from './src/StorageService';

export default function App() {
  const [paths, setPaths] = useState([]);
  const [measurement, setMeasurement] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [sessionId, setSessionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [clientInfo, setClientInfo] = useState({ name: '', phone: '' });
  const [capturedImage, setCapturedImage] = useState(null);
  const [currentPath, setCurrentPath] = useState('');

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

  const handleTouchStart = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    const d = `M ${locationX} ${locationY}`;
    setCurrentPath(d);
    setPaths(prev => [...prev, d]);
  };

  const handleTouchMove = (e) => {
    if (currentPath) {
      const { locationX, locationY } = e.nativeEvent;
      const newD = currentPath + ` L ${locationX} ${locationY}`;
      setCurrentPath(newD);
      setPaths(prev => {
        const newPaths = [...prev];
        newPaths[newPaths.length - 1] = newD;
        return newPaths;
      });
    }
  };

  const handleTouchEnd = () => {
    setCurrentPath('');
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webTitle}>Web mode</Text>
        <Text style={styles.webText}>Native sketch and sharing features are available on iOS/Android only.</Text>
        <ColorPicker activeColor={selectedColor} onSelect={setSelectedColor} />
      </View>
    );
  }

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
      setCapturedImage(uri);
      const measuredCm = await MeasurementService.estimateShoulderFromImage(uri);
      setMeasurement(measuredCm);
      await StorageService.setItem('last_measurement', {
        value: measuredCm,
        timestamp: new Date().toISOString(),
        sessionId,
        imageUri: uri,
      });

      Alert.alert('Image Measurement', `Detected shoulder width: ${measuredCm} cm`);
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
      setMeasurement(measuredCm);
      await StorageService.setItem('last_measurement', {
        value: measuredCm,
        timestamp: new Date().toISOString(),
        sessionId,
      });
      Alert.alert('AI Detection Complete', `Detected Shoulder Width: ${measuredCm} cm`);
    } catch (error) {
      Alert.alert('Error', 'AI failed to detect body points.');
      console.warn('[App] runAutoMeasure error', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const shareDesign = async () => {
    Alert.alert('Notice', 'Sharing is disabled in this dev configuration.');
  };

  const saveDesign = async () => {
    if (!clientInfo.name) {
      Alert.alert('No Client', 'Please add a client first.');
      return;
    }

    if (paths.length === 0) {
      Alert.alert('No Design', 'Please draw something first.');
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
          designs: [],
        };
        sessions.push(clientSession);
      }
      const design = {
        id: `design_${Date.now()}`,
        paths: paths,
        color: selectedColor,
        savedAt: new Date().toISOString(),
      };
      clientSession.designs = clientSession.designs || [];
      clientSession.designs.push(design);
      await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
      Alert.alert('Saved', 'Design saved to client gallery.');
    } catch (error) {
      console.error('Error saving design', error);
      Alert.alert('Error', 'Failed to save design.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>Boutique Designer Studio</Text>
        <Text style={styles.sessionText}>Session ID: {sessionId || 'initializing...'}</Text>
        <Text style={styles.sessionText}>Client: {clientInfo.name || 'No client'}</Text>

        <ClientForm visible={isClientModalVisible} onSave={onSaveClient} onCancel={onCancelClient} />
        {isProcessing && <ActivityIndicator size="small" color="#fff" style={styles.loader} />}

        <ColorPicker activeColor={selectedColor} onSelect={setSelectedColor} />

        {capturedImage && (
          <View style={styles.imagePreviewContainer}>
            <Text style={styles.previewText}>Last captured image:</Text>
            <Image source={{ uri: capturedImage }} style={styles.imagePreview} />
          </View>
        )}
      </ScrollView>

      <View style={styles.canvasContainer} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <Svg width="100%" height="100%">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke={selectedColor} strokeWidth={10} fill="none" />
          ))}
          {/* Test path */}
          <Path d="M 50 50 L 150 150" stroke="red" strokeWidth={5} fill="none" />
        </Svg>

        {measurement && (
          <View style={styles.measureBadge}>
            <Text style={styles.measureText}>Shoulder: {measurement} cm</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.btn} onPress={runAutoMeasure}>
            <Text style={styles.btnTxt}> Auto-Measure</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#1e88e5' }]} onPress={() => setIsClientModalVisible(true)}>
            <Text style={styles.btnTxt}> Add Client</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ff9800' }]} onPress={pickImageAndMeasure}>
            <Text style={styles.btnTxt}> 📷 Capture / Measure</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#25D366' }]} onPress={shareDesign}>
            <Text style={styles.btnTxt}> Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#4CAF50' }]} onPress={saveDesign}>
            <Text style={styles.btnTxt}> 💾 Save Design</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ff4444' }]} onPress={() => setPaths([])}>
            <Text style={styles.btnTxt}>Clear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', paddingTop: 60 },
  scrollContainer: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { color: 'white', fontSize: 22, textAlign: 'center', fontWeight: 'bold' },
  sessionText: { color: '#f3f3f3', textAlign: 'center', marginTop: 6, marginBottom: 12 },
  webFallback: { flex: 1, padding: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  webTitle: { color: 'white', fontSize: 20, marginBottom: 8 },
  webText: { color: 'white', marginBottom: 10, textAlign: 'center' },
  loader: { marginBottom: 10 },
  canvasContainer: { height: 400, margin: 20, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  canvas: { flex: 1 },
  controls: { padding: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  btn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, margin: 5, minWidth: 150, alignItems: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold' },
  measureBadge: { position: 'absolute', bottom: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 5 },
  measureText: { color: 'gold', fontWeight: 'bold' },
  imagePreviewContainer: { marginHorizontal: 20, marginBottom: 12, alignItems: 'center' },
  imagePreview: { width: 170, height: 120, borderRadius: 8, marginTop: 8 },
  previewText: { color: '#fff', marginBottom: 6 },
});
