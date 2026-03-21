import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ClientForm from '../../components/ClientForm';
import ClientSelectionModal from '../../components/ClientSelectionModal';
import ColorPicker from '../../components/ColorPicker';
import { StorageService } from '../../src/StorageService';

export default function SketchTab() {
  const [paths, setPaths] = useState([]);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [sessionId, setSessionId] = useState('');
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [clientInfo, setClientInfo] = useState({ name: '', phone: '' });
  const [currentPath, setCurrentPath] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isClientSelectionVisible, setIsClientSelectionVisible] = useState(false);
  const [clients, setClients] = useState([]);
  const [boutiqueInfo, setBoutiqueInfo] = useState({ name: 'Boutique Designer Studio', iconUri: null });
  const [activeTab, setActiveTab] = useState<'sketch' | 'idea'>('sketch');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUri, setGeneratedImageUri] = useState<string | null>(null);

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
        console.warn('[Sketch] storing session failed', error);
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
      console.warn('[Sketch] failed to save client info', error);
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

  const handleTouchStart = (e) => {
    setIsDrawing(true);
    const { locationX, locationY } = e.nativeEvent;
    const d = `M ${locationX} ${locationY}`;
    setCurrentPath(d);
    setPaths(prev => [...prev, { d, color: selectedColor }]);
  };

  const handleTouchMove = (e) => {
    if (currentPath) {
      const { locationX, locationY } = e.nativeEvent;
      const newD = currentPath + ` L ${locationX} ${locationY}`;
      setCurrentPath(newD);
      setPaths(prev => {
        const newPaths = [...prev];
        newPaths[newPaths.length - 1] = { ...newPaths[newPaths.length - 1], d: newD };
        return newPaths;
      });
    }
  };

  const handleTouchEnd = () => {
    setCurrentPath('');
    setIsDrawing(false);
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
      await StorageService.setItem('@boutique_sessions', sessions);
      Alert.alert('Saved', 'Design saved to client gallery.');
    } catch (error) {
      console.error('Error saving design', error);
      Alert.alert('Error', 'Failed to save design.');
    }
  };

  const generateAIImage = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Prompt Required', 'Please describe the design you want to generate.');
      return;
    }

    let apiKey = await AsyncStorage.getItem('@boutique_hf_key');
    if (!apiKey) apiKey = process.env.EXPO_PUBLIC_HF_API_KEY; // Fallback to environment variable if desired

    if (!apiKey) {
      Alert.alert('Missing API Key', 'Please configure the Hugging Face API Key in the Admin settings to use the Idea Studio.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          inputs: `High quality fashion design sketch, boutique clothing: ${aiPrompt}`,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error || 'Failed to generate image from Hugging Face.';
        if (errorData.estimated_time) {
          errorMessage = `Model is currently loading. Please try again in ${Math.ceil(errorData.estimated_time)} seconds.`;
        }
        Alert.alert('AI Generation Failed', errorMessage);
        setIsGenerating(false);
        return;
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setGeneratedImageUri(reader.result as string);
        setIsGenerating(false);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      Alert.alert('Network Error', 'Failed to connect to the AI service.');
      setIsGenerating(false);
    }
  };

  const saveGeneratedImage = async () => {
    if (!clientInfo.name) {
      Alert.alert('No Client', 'Please select a client first.');
      return;
    }
    if (!generatedImageUri) return;

    try {
      const fileName = `ai_design_${Date.now()}.jpg`;
      const localUri = `${FileSystem.documentDirectory}${fileName}`;
      
      let finalUri = localUri;
      if (generatedImageUri.startsWith('data:')) {
        const base64Data = generatedImageUri.split(',')[1];
        await FileSystem.writeAsStringAsync(localUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
      } else {
        const { uri } = await FileSystem.downloadAsync(generatedImageUri, localUri);
        finalUri = uri;
      }

      const sessions = await StorageService.loadAllSessions();
      let clientSession = sessions.find(s => s.name === clientInfo.name);
      if (!clientSession) {
        clientSession = { id: `session_${Date.now()}`, name: clientInfo.name, phone: clientInfo.phone, designs: [] };
        sessions.push(clientSession);
      }
      
      clientSession.designs = clientSession.designs || [];
      clientSession.designs.push({ id: `design_${Date.now()}`, imageUri: finalUri, savedAt: new Date().toISOString(), isAiGenerated: true, prompt: aiPrompt });
      
      await StorageService.setItem('@boutique_sessions', sessions);
      Alert.alert('Saved', 'AI Design safely saved to client gallery.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save the generated design.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={!isDrawing}>
        <View style={styles.headerContainer}>
          {boutiqueInfo.iconUri && <Image source={{ uri: boutiqueInfo.iconUri }} style={styles.boutiqueIcon} contentFit="cover" />}
          <Text style={styles.header}>{boutiqueInfo.name} - Sketch</Text>
        </View>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'sketch' && styles.tabBtnActive]} onPress={() => setActiveTab('sketch')}>
            <Text style={[styles.tabTxt, activeTab === 'sketch' && styles.tabTxtActive]}>Sketchpad</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'idea' && styles.tabBtnActive]} onPress={() => setActiveTab('idea')}>
            <Text style={[styles.tabTxt, activeTab === 'idea' && styles.tabTxtActive]}>Idea Studio (AI)</Text>
          </TouchableOpacity>
        </View>

        <ClientForm visible={isClientModalVisible} onSave={onSaveClient} onCancel={onCancelClient} />

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

        <View style={styles.clientBadgeRow}>
          <Text style={styles.sessionText}>Client: {clientInfo.name || 'No client'}</Text>
          <TouchableOpacity style={styles.changeClientBtn} onPress={openClientSelection}>
            <Text style={styles.changeClientBtnTxt}>{clientInfo.name ? 'Change' : 'Select Client'}</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'sketch' ? (
          <>
            <ColorPicker activeColor={selectedColor} onSelect={setSelectedColor} />
            <View style={styles.canvasContainer}>
              <ScrollView
                style={styles.canvasScroll}
                contentContainerStyle={styles.canvasContent}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                scrollEnabled={!isDrawing}
              >
                <Svg width={2000} height={2000}>
                  {paths.map((p, i) => (
                    <Path key={i} d={p.d} stroke={p.color} strokeWidth={4} fill="none" />
                  ))}
                </Svg>
              </ScrollView>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={saveDesign}>
                <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.btnTxt}>Save Sketch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={() => setPaths([])}>
                <Ionicons name="trash-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.btnTxt}>Clear Canvas</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.ideaStudioContainer}>
            <TextInput 
              style={styles.promptInput}
              placeholder="Describe your design (e.g. A beautiful flowing red evening gown with floral embroidery...)"
              placeholderTextColor="#999"
              multiline
              value={aiPrompt}
              onChangeText={setAiPrompt}
            />
            <TouchableOpacity style={styles.generateBtn} onPress={generateAIImage} disabled={isGenerating}>
              {isGenerating ? <ActivityIndicator color="white" /> : (
                <>
                  <Ionicons name="sparkles" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.btnTxt}>Generate AI Concept</Text>
                </>
              )}
            </TouchableOpacity>

            {generatedImageUri && (
              <View style={styles.generatedImageContainer}>
                <Image source={{ uri: generatedImageUri }} style={styles.generatedImage} contentFit="contain" />
                <TouchableOpacity style={styles.saveAiBtn} onPress={saveGeneratedImage}>
                  <Ionicons name="download-outline" size={20} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.btnTxt}>Save to Client Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a' },
  scrollContent: { paddingBottom: 20 },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, paddingHorizontal: 15 },
  boutiqueIcon: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  header: { color: 'white', fontSize: 20, textAlign: 'center', fontWeight: 'bold', flexShrink: 1 },
  
  tabContainer: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#2a2a2a', borderRadius: 10, padding: 5 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#6200ee' },
  tabTxt: { color: '#aaa', fontWeight: 'bold' },
  tabTxtActive: { color: 'white' },

  clientBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, backgroundColor: '#333', padding: 10, borderRadius: 8 },
  sessionText: { color: '#f3f3f3', fontWeight: 'bold' },
  changeClientBtn: { backgroundColor: '#444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  changeClientBtnTxt: { color: '#fff', fontSize: 12 },

  canvasContainer: { height: 400, margin: 20, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  canvasScroll: { flex: 1 },
  canvasContent: { width: 2000, height: 2000 },
  controls: { paddingHorizontal: 15, paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#6200ee' },
  btnSecondary: { backgroundColor: '#444' },
  btnDanger: { backgroundColor: '#ff4444' },
  btnTxt: { color: 'white', fontWeight: 'bold' },

  ideaStudioContainer: { flex: 1, paddingHorizontal: 20, marginTop: 10 },
  promptInput: { backgroundColor: '#2a2a2a', color: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#444', minHeight: 120, textAlignVertical: 'top', marginBottom: 15 },
  generateBtn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  generatedImageContainer: { alignItems: 'center', marginBottom: 20 },
  generatedImage: { width: '100%', height: 400, borderRadius: 15, backgroundColor: '#2a2a2a' },
  saveAiBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 15, width: '100%' },
});