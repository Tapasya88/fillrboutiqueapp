import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import ClientForm from '../../components/ClientForm';
import { MeasurementService } from '../../src/MeasurementService';
import { StorageService } from '../../src/StorageService';

export default function CustomersTab() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [manualMeasurement, setManualMeasurement] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isClientModalVisible, setIsClientModalVisible] = useState(false);
  const [clientOrders, setClientOrders] = useState([]); // New state for client-specific orders
  const [availableDesigns, setAvailableDesigns] = useState([]);
  const [availableMeasurements, setAvailableMeasurements] = useState([]);
  const [isDesignSelectionModalVisible, setIsDesignSelectionModalVisible] = useState(false);
  const [isMeasurementSelectionModalVisible, setIsMeasurementSelectionModalVisible] = useState(false);
  const [isCreateOrderModalVisible, setIsCreateOrderModalVisible] = useState(false); // New state for order creation modal
  const [selectedDesignsForNewOrder, setSelectedDesignsForNewOrder] = useState<string[]>([]);
  const [selectedMeasurementTimestampForNewOrder, setSelectedMeasurementTimestampForNewOrder] = useState<string | null>(null);
  const [newOrder, setNewOrder] = useState({ deliveryDate: '', status: 'pending', notes: '', totalValue: '', advancePaid: '' });
  const [boutiqueInfo, setBoutiqueInfo] = useState({ name: 'Boutique Designer Studio', iconUri: null, upiId: '' });
  const [isQrModalVisible, setIsQrModalVisible] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState('');

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
      loadClients();
      if (selectedClient) {
        selectClient(selectedClient);
      }
    }, [selectedClient])
  );

  const loadClients = async () => {
    try {
      const sessions = await StorageService.loadAllSessions();
      const uniqueClients = sessions.reduce((acc, session) => {
        if (!acc.find(c => c.name === session.name)) {
          // Find an image in measurements to use as profile if no profile image exists
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

  const selectClient = async (client) => {
    setSelectedClient(client);
    try {
      const sessions = await StorageService.loadAllSessions();
      const clientSessions = sessions.filter(s => s.name === client.name);

      // Load measurements for this client
      const allMeasurements = clientSessions.flatMap(s => s.measurements || []);
      const lastMeasurement = await StorageService.getItem('last_measurement');
      if (lastMeasurement && lastMeasurement.sessionId && clientSessions.find(s => s.id === lastMeasurement.sessionId)) {
        if (!allMeasurements.some(m => m.timestamp === lastMeasurement.timestamp)) {
          allMeasurements.push(lastMeasurement);
        }
      }
      setMeasurements(allMeasurements);

      // Load designs for this client
      const allDesigns = clientSessions.flatMap(s => s.designs || []);
      setDesigns(allDesigns);
      setAvailableDesigns(allDesigns); // For new order selection

      // Load orders for this client
      const allOrders = clientSessions.flatMap(s => s.orders || []);
      setClientOrders(allOrders);
      setAvailableMeasurements(allMeasurements); // For new order selection
    } catch (error) {
      console.error('Error loading client data', error);
    }
  };

  const onSaveClient = async (client) => {
    setIsClientModalVisible(false);
    try {
      const sessions = await StorageService.loadAllSessions();
      if (!sessions.find(s => s.name === client.name)) {
        const newSession = {
          id: `session_${Date.now()}`,
          name: client.name,
          phone: client.phone,
          gender: client.gender,
          imageUri: client.imageUri,
          measurements: [],
          designs: [],
        };
        sessions.push(newSession);
        await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
        loadClients();
      } else {
        Alert.alert('Exists', 'Customer already exists.');
      }
    } catch (error) {
      console.error('Error adding client', error);
    }
  };

  const deleteClient = (clientName) => {
    Alert.alert('Delete Customer', `Are you sure you want to delete ${clientName} and all their data?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const sessions = await StorageService.loadAllSessions();
          const filteredSessions = sessions.filter(s => s.name !== clientName);
          await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(filteredSessions));
          loadClients();
          if (selectedClient?.name === clientName) setSelectedClient(null);
          setClientOrders([]); // Clear orders if client is deleted
        } catch (error) {
          console.error('Error deleting client', error);
        }
      }},
    ]);
  };

  const openCreateOrderModal = () => {
    setNewOrder({ deliveryDate: '', status: 'pending', notes: '', totalValue: '', advancePaid: '' });
    setSelectedDesignsForNewOrder([]);
    setSelectedMeasurementTimestampForNewOrder(null);
    setIsCreateOrderModalVisible(true);
  };

  const onCreateOrder = async () => {
    if (!newOrder.deliveryDate) {
      Alert.alert('Missing Info', 'Please enter a delivery date.');
      return;
    }

    try {
      const sessions = await StorageService.loadAllSessions();
      let clientSession = sessions.find(s => s.name === selectedClient?.name);
      
      if (clientSession) {
        clientSession.orders = clientSession.orders || [];
        const orderToSave = {
          ...newOrder,
          id: `order_${Date.now()}`,
          clientId: clientSession.id,
          orderDate: new Date().toISOString().split('T')[0],
          designIds: selectedDesignsForNewOrder,
          measurementTimestamp: selectedMeasurementTimestampForNewOrder,
        };
        clientSession.orders.push(orderToSave);
        await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
        
        setClientOrders(clientSession.orders);
        setIsCreateOrderModalVisible(false);
        Alert.alert('Success', 'Order created successfully!');
      }
    } catch (error) {
      console.error('Error creating order', error);
      Alert.alert('Error', 'Failed to create order.');
    }
  };

  const autoMeasureFromImage = async () => {
    if (!selectedClient) return;

    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus.status !== 'granted') {
      Alert.alert('Permission required', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });

    const isCancelled = result.cancelled === true || result.canceled === true;
    const uri = result.uri ?? result?.assets?.[0]?.uri ?? null;

    if (!isCancelled && uri) {
      setIsProcessing(true);
      try {
        const fileName = uri.split('/').pop() || `image_${Date.now()}.jpg`;
        const newUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.copyAsync({ from: uri, to: newUri });

        const measuredCm = await MeasurementService.estimateShoulderFromImage(newUri);
        const shoulderNum = parseFloat(measuredCm);
        const timestamp = new Date().toISOString();

        const generatedMeasurements = [
          { field: 'shoulder', value: shoulderNum.toFixed(1), timestamp, type: 'auto_image', imageUri: newUri },
          { field: 'bust', value: (shoulderNum * 2.2).toFixed(1), timestamp, type: 'auto_image' },
          { field: 'waist', value: (shoulderNum * 1.8).toFixed(1), timestamp, type: 'auto_image' },
          { field: 'hips', value: (shoulderNum * 2.4).toFixed(1), timestamp, type: 'auto_image' },
          { field: 'sleeveLength', value: (shoulderNum * 1.5).toFixed(1), timestamp, type: 'auto_image' },
          { field: 'garmentLength', value: (shoulderNum * 2.5).toFixed(1), timestamp, type: 'auto_image' },
        ];

        const sessions = await StorageService.loadAllSessions();
        let clientSession = sessions.find(s => s.name === selectedClient.name);
        if (!clientSession) {
          clientSession = { id: `session_${Date.now()}`, name: selectedClient.name, phone: selectedClient.phone, measurements: [] };
          sessions.push(clientSession);
        }
        clientSession.measurements = clientSession.measurements || [];
        clientSession.measurements.push(...generatedMeasurements);
        await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));

        setMeasurements([...measurements, ...generatedMeasurements]);
        Alert.alert('Measurements Added', `Auto-populated full profile based on Shoulder: ${measuredCm} cm`);
      } catch (error) {
        console.error('Error measuring from image', error);
        Alert.alert('Error', 'Failed to measure from image.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const addManualMeasurement = async () => {
    if (!manualMeasurement || isNaN(manualMeasurement)) {
      Alert.alert('Invalid Input', 'Please enter a valid number.');
      return;
    }
    const newMeasurement = {
      value: parseFloat(manualMeasurement),
      timestamp: new Date().toISOString(),
      type: 'manual',
    };
    await saveMeasurement(newMeasurement);
    setMeasurements([...measurements, newMeasurement]);
    setManualMeasurement('');
    setModalVisible(false);
  };

  const saveMeasurement = async (measurement) => {
    try {
      const sessions = await StorageService.loadAllSessions();
      let clientSession = sessions.find(s => s.name === selectedClient.name);
      if (!clientSession) {
        clientSession = {
          id: `session_${Date.now()}`,
          name: selectedClient.name,
          phone: selectedClient.phone,
          measurements: [],
        };
        sessions.push(clientSession);
      }
      clientSession.measurements = clientSession.measurements || [];
      clientSession.measurements.push(measurement);
      await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
    } catch (error) {
      console.error('Error saving measurement', error);
    }
  };

  const editMeasurement = (measurement) => {
    // For simplicity, allow editing value
    Alert.prompt('Edit Measurement', 'Enter new value:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: async (newValue) => {
        if (newValue && !isNaN(newValue)) {
          measurement.value = parseFloat(newValue);
          // Update in storage
          try {
            const sessions = await StorageService.loadAllSessions();
            const clientSession = sessions.find(s => s.name === selectedClient.name);
            if (clientSession) {
              const index = clientSession.measurements.findIndex(m => m.timestamp === measurement.timestamp);
              if (index !== -1) {
                clientSession.measurements[index] = measurement;
                await AsyncStorage.setItem('@boutique_sessions', JSON.stringify(sessions));
                setMeasurements([...measurements]); // Refresh
              }
            }
          } catch (error) {
            console.error('Error updating measurement', error);
          }
        }
      }},
    ]);
  };

  const renderClient = ({ item }) => {
    const defaultAvatar = item.gender === 'male'
      ? 'https://cdn-icons-png.flaticon.com/512/2815/2815428.png'
      : 'https://cdn-icons-png.flaticon.com/512/1144/1144709.png';

    return (
      <TouchableOpacity style={styles.clientItem} onPress={() => selectClient(item)}>
        <Image 
          source={{ uri: item.imageUri || defaultAvatar }} 
          style={styles.clientAvatar} 
          contentFit="cover"
        />
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.name}</Text>
          <Text style={styles.clientPhone}>{item.phone}</Text>
        </View>
        <TouchableOpacity style={styles.deleteClientBtn} onPress={() => deleteClient(item.name)}>
          <Text style={styles.deleteClientTxt}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const formatLabel = (field) => {
    if (!field) return 'Shoulder'; // Fallback for old data
    const result = field.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  const renderMeasurement = ({ item }) => (
    <View style={styles.measurementItemWrapper}>
      <View style={styles.measurementItem}>
        <Text style={styles.measureText}>{formatLabel(item.field)}: {item.value} cm</Text>
        <Text style={styles.measureDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => editMeasurement(item)}>
          <Text style={styles.editTxt}>Edit</Text>
        </TouchableOpacity>
      </View>
      {item.imageUri && (
        <Image source={{ uri: item.imageUri }} style={styles.measurementImage} contentFit="cover" />
      )}
    </View>
  );

  const renderDesign = ({ item }) => (
    <View style={styles.designItem}>
      <Text style={styles.designDate}>Saved: {new Date(item.savedAt).toLocaleDateString()}</Text>
      <View style={styles.designCanvas}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Svg height="100" width="100" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
            {item.paths?.map((pathData, index) => {
              const isString = typeof pathData === 'string';
              const d = isString ? pathData : pathData.d;
              const strokeColor = isString ? (item.color || 'black') : pathData.color;
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
    </View>
  );

  const shareOrderOnWhatsApp = (order) => {
    const phone = selectedClient?.phone || '';
    
    const message = `Hello ${selectedClient?.name},\n\nHere are your order details from ${boutiqueInfo.name || 'our Boutique'}:\n\n` +
      `📦 *Order ID*: ${order.id.substring(0, 8)}\n` +
      `📅 *Delivery Date*: ${new Date(order.deliveryDate).toLocaleDateString()}\n` +
      `💰 *Total Value*: ₹${order.totalValue || '0'}\n` +
      `✅ *Advance Paid*: ₹${order.advancePaid || '0'}\n` +
      `⏳ *Balance Due*: ₹${(parseFloat(order.totalValue || '0') - parseFloat(order.advancePaid || '0')).toFixed(2)}\n` +
      `📝 *Status*: ${order.status.replace(/_/g, ' ')}\n\n` +
      `Thank you!`;

    const url = `whatsapp://send?text=${encodeURIComponent(message)}` + (phone ? `&phone=${phone.replace(/\D/g, '')}` : '');
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (!supported) {
          Alert.alert('Error', 'WhatsApp is not installed on your device');
        } else {
          return Linking.openURL(url);
        }
      })
      .catch((err) => console.error('An error occurred', err));
  };

  const renderOrderItem = ({ item }) => (
    <View style={styles.orderItem}>
      <View style={{ flex: 1 }}>
        <Text style={styles.orderTitle}>Order: {item.id.substring(0, 8)}...</Text>
        <Text style={styles.orderDate}>Delivery: {item.deliveryDate}</Text>
        <Text style={styles.orderDate}>Bal: ₹{(parseFloat(item.totalValue || '0') - parseFloat(item.advancePaid || '0')).toFixed(2)}</Text>
        <Text style={styles.orderStatus}>Status: {item.status.replace(/_/g, ' ')}</Text>
      </View>
      <TouchableOpacity style={styles.shareBtnSmall} onPress={() => shareOrderOnWhatsApp(item)}>
        <Ionicons name="logo-whatsapp" size={18} color="white" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {boutiqueInfo.iconUri && <Image source={{ uri: boutiqueInfo.iconUri }} style={styles.boutiqueIcon} contentFit="cover" />}
        <Text style={styles.header}>{boutiqueInfo.name} - Customers</Text>
      </View>
      {!selectedClient ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.addClientBtn} onPress={() => setIsClientModalVisible(true)}>
            <Ionicons name="person-add" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={styles.addClientTxt}>Add Customer</Text>
          </TouchableOpacity>
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            renderItem={renderClient}
          />
          <ClientForm visible={isClientModalVisible} onSave={onSaveClient} onCancel={() => setIsClientModalVisible(false)} />
        </View>
      ) : (
        <View>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setSelectedClient(null);
              setMeasurements([]);
              setDesigns([]);
            }}>
            <Ionicons name="arrow-back" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.backTxt}>Back to Customers</Text>
          </TouchableOpacity>
          <Text style={styles.clientHeader}>{selectedClient.name}</Text>
          <Text style={styles.subHeader}>Measurements</Text>
          {measurements.length === 0 ? (
            <Text style={styles.noMeasurements}>No measurements recorded.</Text>
          ) : (
            <FlatList
              data={measurements}
              keyExtractor={(item, index) => item.timestamp + (item.field ? '_' + item.field : '_' + index)}
              renderItem={renderMeasurement}
            />
          )}
          <Text style={styles.subHeader}>Saved Designs</Text>
          {designs.length === 0 ? (
            <Text style={styles.noMeasurements}>No designs saved for this client.</Text>
          ) : (
            <FlatList
              data={designs}
              keyExtractor={(item) => item.id}
              renderItem={renderDesign}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          )}
          <Text style={styles.subHeader}>Orders</Text>
          {clientOrders.length === 0 ? (
            <Text style={styles.noMeasurements}>No orders for this client.</Text>
          ) : (
            <FlatList
              data={clientOrders}
              keyExtractor={(item) => item.id}
              renderItem={renderOrderItem}
              horizontal
              showsHorizontalScrollIndicator={false}
            />
          )}
          <View style={styles.addOptions}>
            <TouchableOpacity style={styles.optionBtn} onPress={openCreateOrderModal}>
              <Ionicons name="add-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.optionTxt}>Create New Order</Text>
            </TouchableOpacity>
          </View>

          {/* Order Creation Modal for selected client */}
          {/* ... (Modal definition will go here) ... */}
          <View style={styles.addOptions}>
            {isProcessing && <ActivityIndicator size="small" color="#000" />}
            <TouchableOpacity style={styles.optionBtnSecondary} onPress={autoMeasureFromImage} disabled={isProcessing}>
              <Ionicons name="camera-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.optionTxt}>Auto Measure from Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionBtnSecondary} onPress={() => setModalVisible(true)}>
              <Ionicons name="pencil-outline" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={styles.optionTxt}>Manual Input</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal for creating a new order for the selected client */}
      {selectedClient && (
        <Modal visible={isCreateOrderModalVisible} animationType="slide">
          <View style={styles.modal}>
            <Text style={styles.modalHeaderTitle}>Create Order for {selectedClient.name}</Text>
            <TextInput
              style={styles.input}
              placeholder="Delivery Date (YYYY-MM-DD)"
              placeholderTextColor="#999"
              value={newOrder.deliveryDate}
              onChangeText={(text) => setNewOrder(prev => ({ ...prev, deliveryDate: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Status (e.g., pending, in_progress)"
              placeholderTextColor="#999"
              value={newOrder.status}
              onChangeText={(text) => setNewOrder(prev => ({ ...prev, status: text as any }))} // Type assertion for now
            />
            <TextInput
              style={styles.input}
              placeholder="Notes"
              placeholderTextColor="#999"
              value={newOrder.notes}
              onChangeText={(text) => setNewOrder(prev => ({ ...prev, notes: text }))}
              multiline
            />

            <TextInput
              style={styles.input}
              placeholder="Total Order Value (₹)"
              placeholderTextColor="#999"
              value={newOrder.totalValue}
              onChangeText={(text) => setNewOrder(prev => ({ ...prev, totalValue: text }))}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Advance Paid (₹)"
                placeholderTextColor="#999"
                value={newOrder.advancePaid}
                onChangeText={(text) => setNewOrder(prev => ({ ...prev, advancePaid: text }))}
                keyboardType="numeric"
              />
              <TouchableOpacity 
                style={styles.upiBtn} 
                onPress={async () => {
                  const amount = parseFloat(newOrder.advancePaid || '0');
                  if (isNaN(amount) || amount <= 0) {
                    Alert.alert('Invalid', 'Please enter an advance amount to collect.');
                    return;
                  }
                  const upiAccount = boutiqueInfo.upiId || 'boutique@upi';
                  const upiUrl = `upi://pay?pa=${upiAccount}&pn=${encodeURIComponent(boutiqueInfo.name || 'Boutique')}&am=${amount}&cu=INR`;
                  try {
                    const supported = await Linking.canOpenURL(upiUrl);
                    if (supported) await Linking.openURL(upiUrl);
                    else Alert.alert('Notice', 'No UPI app found. Advance recorded locally.');
                  } catch (e) { Alert.alert('Error', 'Failed to launch UPI application.'); }
                }}>
                <Ionicons name="send-outline" size={18} color="white" style={{ marginRight: 4 }} />
                <Text style={styles.btnTxt}>App</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.upiBtn, { backgroundColor: '#1e88e5' }]} 
                onPress={() => {
                  const amount = parseFloat(newOrder.advancePaid || '0');
                  if (isNaN(amount) || amount <= 0) {
                    Alert.alert('Invalid', 'Please enter an advance amount to generate QR.');
                    return;
                  }
                  if (!boutiqueInfo.upiId) {
                    Alert.alert('Missing Info', 'Please configure your UPI ID in the Admin settings first.');
                    return;
                  }
                  const upiUrl = `upi://pay?pa=${boutiqueInfo.upiId}&pn=${encodeURIComponent(boutiqueInfo.name || 'Boutique')}&am=${amount}&cu=INR`;
                  setQrCodeValue(upiUrl);
                  setIsQrModalVisible(true);
                }}
              >
                <Ionicons name="qr-code-outline" size={18} color="white" style={{ marginRight: 4 }} />
                <Text style={styles.btnTxt}>QR Code</Text>
              </TouchableOpacity>

            <View style={styles.modalFooter}>
            </View>
            
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Linked Designs:</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setIsDesignSelectionModalVisible(true)}
                >
                  <Text style={styles.selectButtonText}>
                    {selectedDesignsForNewOrder.length > 0 ? `${selectedDesignsForNewOrder.length} Designs Selected` : 'Select Designs'}
                  </Text>
                </TouchableOpacity>
                {selectedDesignsForNewOrder.length > 0 && (
                  <Text style={styles.selectedItemsText}>
                    {selectedDesignsForNewOrder.map(id => `...${id.substring(id.length - 4)}`).join(', ')}
                  </Text>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Linked Measurement Set:</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => setIsMeasurementSelectionModalVisible(true)}
                >
                  <Text style={styles.selectButtonText}>
                    {selectedMeasurementTimestampForNewOrder ? `Selected: ${new Date(selectedMeasurementTimestampForNewOrder).toLocaleDateString()}` : 'Select Measurement Set'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCreateOrderModalVisible(false)}>
                <Ionicons name="close-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.btnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={onCreateOrder}>
                <Ionicons name="checkmark-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.btnTxt}>Create Order</Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modal}>
          <Text style={styles.modalHeader}>Manual Measurement</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter shoulder width in cm"
            placeholderTextColor="#999"
            value={manualMeasurement}
            onChangeText={setManualMeasurement}
            keyboardType="numeric"
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close-outline" size={20} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.btnTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={addManualMeasurement}>
              <Ionicons name="add-outline" size={20} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.btnTxt}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Design Selection Modal for New Order */}
      <Modal visible={isDesignSelectionModalVisible} animationType="slide">
        <View style={styles.modalContainer}> {/* Reusing modalContainer for consistent styling */}
          <Text style={styles.modalHeaderTitle}>Select Designs</Text>
          <FlatList
            data={availableDesigns}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.selectionItem,
                  selectedDesignsForNewOrder.includes(item.id) && styles.selectedSelectionItem,
                ]}
                onPress={() => {
                  setSelectedDesignsForNewOrder(prev => {
                    const newDesignIds = prev.includes(item.id)
                      ? prev.filter(id => id !== item.id)
                      : [...prev, item.id];
                    return newDesignIds;
                  });
                }}
              >
                <Text style={styles.selectionItemText}>Design: {new Date(item.savedAt).toLocaleDateString()}</Text>
                <Text style={styles.selectionItemTextSmall}>{item.imageUri ? 'Reference Image' : `Paths: ${item.paths?.length || 0}`}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No designs for this client.</Text>}
          />
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.submitBtn} onPress={() => setIsDesignSelectionModalVisible(false)}>
              <Ionicons name="checkmark-outline" size={20} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.btnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Measurement Selection Modal for New Order */}
      <Modal visible={isMeasurementSelectionModalVisible} animationType="slide">
        <View style={styles.modalContainer}>
          <Text style={styles.modalHeaderTitle}>Select Measurement Set</Text> {/* Reusing modalContainer for consistent styling */}
          <FlatList
            data={availableMeasurements}
            keyExtractor={(item, index) => item.timestamp + (item.field ? '_' + item.field : '_' + index)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.selectionItem,
                  selectedMeasurementTimestampForNewOrder === item.timestamp && styles.selectedSelectionItem,
                ]}
                onPress={() => {
                  setSelectedMeasurementTimestampForNewOrder(item.timestamp);
                  setIsMeasurementSelectionModalVisible(false);
                }}
              >
                <Text style={styles.selectionItemText}>
                  {item.field ? `${item.field.charAt(0).toUpperCase() + item.field.slice(1)}: ${item.value} cm` : `Measurement Set: ${new Date(item.timestamp).toLocaleDateString()}`}
                </Text>
                <Text style={styles.selectionItemTextSmall}>Date: {new Date(item.timestamp).toLocaleDateString()}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No measurements for this client.</Text>}
          />
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsMeasurementSelectionModalVisible(false)}>
              <Ionicons name="close-outline" size={20} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.btnTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal for Customer Tab */}
      <Modal visible={isQrModalVisible} animationType="fade" transparent={true} onRequestClose={() => setIsQrModalVisible(false)}>
        <View style={styles.qrModalContainer}>
          <View style={styles.qrModalContent}>
            <Text style={styles.qrModalTitle}>Scan to Pay</Text>
            <View style={styles.qrCodeWrapper}>
              {qrCodeValue ? <QRCode value={qrCodeValue} size={200} /> : null}
            </View>
            <Text style={styles.qrModalAmount}>Amount: ₹{newOrder.advancePaid}</Text>
            <Text style={styles.qrModalUpiId}>{boutiqueInfo.upiId}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsQrModalVisible(false)}>
              <Text style={styles.btnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#1a1a1a' },
  headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, paddingHorizontal: 15 },
  boutiqueIcon: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  header: { fontSize: 20, fontWeight: 'bold', color: 'white', textAlign: 'center', flexShrink: 1 },
  clientItem: { backgroundColor: '#2a2a2a', padding: 15, marginBottom: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  clientAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#444' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  clientPhone: { fontSize: 14, color: '#ccc' },
  deleteClientBtn: { backgroundColor: '#ff4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
  deleteClientTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  addClientBtn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  addClientTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  backBtn: { backgroundColor: '#444', padding: 10, borderRadius: 8, marginBottom: 20, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  backTxt: { color: '#fff', fontWeight: 'bold' },
  clientHeader: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, color: 'white' },
  subHeader: { fontSize: 18, marginBottom: 10, color: '#ccc' },
  noMeasurements: { fontSize: 16, textAlign: 'center', marginTop: 20, color: '#999' },
  measurementItemWrapper: { backgroundColor: '#2a2a2a', padding: 15, marginBottom: 10, borderRadius: 8 },
  measurementItem: { flexDirection: 'row', alignItems: 'center' },
  measureText: { flex: 1, fontSize: 16, color: 'white' },
  measureDate: { fontSize: 14, color: '#ccc', marginRight: 10 },
  editBtn: { backgroundColor: '#ff9800', padding: 5, borderRadius: 5 },
  editTxt: { color: '#fff', fontSize: 12 },
  measurementImage: { width: '100%', height: 200, borderRadius: 8, marginTop: 10 },
  addOptions: { marginTop: 20 },
  optionBtn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  optionBtnSecondary: { backgroundColor: '#444', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  optionTxt: { color: '#fff', fontWeight: 'bold' },
  modal: { flex: 1, padding: 20, backgroundColor: '#1a1a1a', paddingTop: 60 }, // Consistent dark background
  modalHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', color: 'white' },
  modalHeaderTitle: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#444', backgroundColor: '#333', color: 'white', padding: 10, marginBottom: 20, borderRadius: 5 },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  designItem: {
    backgroundColor: '#2a2a2a',
    padding: 10,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  designCanvas: { width: 100, height: 100, backgroundColor: '#fff', marginTop: 5, borderRadius: 4, overflow: 'hidden' },
  designDate: { fontSize: 12, color: '#ccc' },
  modalContainer: { flex: 1, backgroundColor: '#1a1a1a', padding: 20, paddingTop: 60 },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 },
  cancelBtn: { backgroundColor: '#444', padding: 15, borderRadius: 10, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#ccc' },
  upiBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 15,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
  },
  qrModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  qrCodeWrapper: { padding: 15, backgroundColor: '#fff', borderRadius: 10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  qrModalAmount: { fontSize: 24, fontWeight: 'bold', color: '#4CAF50', marginTop: 20 },
  qrModalUpiId: { fontSize: 14, color: '#666', marginTop: 5, marginBottom: 20 },
  closeButton: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, minWidth: 150, alignItems: 'center' },
});

// New styles for order creation/selection
const orderCreationStyles = StyleSheet.create({
  formGroup: { marginBottom: 15 },
  formLabel: { fontSize: 16, color: 'white', marginBottom: 5 },
  selectButton: {
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectButtonText: { color: 'white', fontSize: 16 },
  selectedItemsText: { color: '#ccc', fontSize: 12, marginTop: 5, textAlign: 'center' },
  selectionItem: {
    backgroundColor: '#333',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedSelectionItem: { borderColor: '#89CFF0', borderWidth: 2 },
  selectionItemText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  selectionItemTextSmall: { color: '#ccc', fontSize: 12 },
});

// New styles for orders in customer tab
const orderStyles = StyleSheet.create({
  orderItem: { backgroundColor: '#2a2a2a', padding: 10, marginBottom: 5, borderRadius: 5, marginRight: 10, flexDirection: 'row', alignItems: 'center' },
  orderTitle: { fontWeight: 'bold', fontSize: 14, color: 'white' },
  orderDate: { fontSize: 12, color: '#ccc' },
  orderStatus: { fontSize: 12, color: '#89CFF0' },
  shareBtnSmall: { backgroundColor: '#25D366', padding: 8, borderRadius: 5, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
});
Object.assign(styles, orderStyles, orderCreationStyles); // Merge new styles