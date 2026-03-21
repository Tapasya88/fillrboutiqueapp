import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ClientSelectionModal from '../../components/ClientSelectionModal';
import { StorageService } from '../../src/StorageService';

// Define the Order type
interface Order {
  id: string;
  clientId: string;
  clientName: string;
  orderDate: string;
  deliveryDate: string;
  status: 'pending' | 'in_progress' | 'ready_for_pickup' | 'completed' | 'cancelled';
  designIds: string[]; // Array of design IDs
  measurementTimestamp: string; // Timestamp of the measurement set
  totalValue?: string;
  advancePaid?: string;
  notes: string;
}

const initialOrderState: Order = {
  id: '',
  clientId: '',
  clientName: '',
  orderDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  deliveryDate: '',
  status: 'pending',
  designIds: [],
  measurementTimestamp: '',
  totalValue: '',
  advancePaid: '',
  notes: '',
};

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isOrderModalVisible, setIsOrderModalVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order>(initialOrderState);
  const [clients, setClients] = useState([]); // For client selection
  const [isClientSelectionVisible, setIsClientSelectionVisible] = useState(false);
  const [selectedClientForOrder, setSelectedClientForOrder] = useState(null); // Client selected for the current order being edited/created
  const [clientDesigns, setClientDesigns] = useState([]);
  const [clientMeasurements, setClientMeasurements] = useState([]);
  const [isDesignSelectionVisible, setIsDesignSelectionVisible] = useState(false);
  const [isMeasurementSelectionVisible, setIsMeasurementSelectionVisible] = useState(false);
  const [isDesignViewerVisible, setIsDesignViewerVisible] = useState(false);
  const [selectedDesignForView, setSelectedDesignForView] = useState<any>(null);
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
      loadOrders();
      loadClients(); // Load clients for selection
    }, [])
  );

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
      console.error('Error loading clients for order selection', error);
    }
  };

  const loadClientSpecificData = async (clientId: string) => {
    try {
      const sessions = await StorageService.loadAllSessions();
      const clientSession = sessions.find(s => s.id === clientId);
      if (clientSession) {
        setClientDesigns(clientSession.designs || []);
        setClientMeasurements(clientSession.measurements || []);
      } else {
        setClientDesigns([]);
        setClientMeasurements([]);
      }
    } catch (error) {
      console.error('Error loading client specific data', error);
    }
  };
  const loadOrders = async () => {
    try {
      const sessions = await StorageService.loadAllSessions();
      const allOrders: Order[] = sessions.flatMap(session =>
        (session.orders || []).map(order => ({ ...order, clientName: session.name }))
      );
      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders', error);
    }
  };

  const onSaveOrder = async () => {
    if (!selectedClientForOrder || !currentOrder.deliveryDate) {
      Alert.alert('Missing Info', 'Please select a client and delivery date.');
      return;
    }

    try {
      const sessions = await StorageService.loadAllSessions();
      let clientSession = sessions.find(s => s.name === selectedClientForOrder.name);

      if (!clientSession) {
        Alert.alert('Error', 'Selected client not found in sessions.');
        return;
      }

      clientSession.orders = clientSession.orders || [];

      const orderToSave: Order = {
        ...currentOrder,
        id: currentOrder.id || `order_${Date.now()}`,
        clientId: selectedClientForOrder.id,
        clientName: selectedClientForOrder.name,
      };

      if (currentOrder.id) {
        // Update existing order
        const orderIndex = clientSession.orders.findIndex(o => o.id === currentOrder.id);
        if (orderIndex !== -1) {
          clientSession.orders[orderIndex] = orderToSave;
        }
      } else {
        // Add new order
        clientSession.orders.push(orderToSave);
      }

      await StorageService.setItem('@boutique_sessions', sessions);
      Alert.alert('Success', 'Order saved successfully!');
      setIsOrderModalVisible(false);
      setCurrentOrder(initialOrderState);
      setSelectedClientForOrder(null);
      loadOrders(); // Refresh the list
    } catch (error) {
      console.error('Error saving order', error);
      Alert.alert('Error', 'Failed to save order.');
    }
  };

  const deleteOrder = async (orderId: string, clientId: string) => {
    Alert.alert('Delete Order', 'Are you sure you want to delete this order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const sessions = await StorageService.loadAllSessions();
          const clientSession = sessions.find(s => s.id === clientId);

          if (clientSession && clientSession.orders) {
            clientSession.orders = clientSession.orders.filter(o => o.id !== orderId);
            await StorageService.setItem('@boutique_sessions', sessions);
            loadOrders(); // Refresh the list
          }
        } catch (error) {
          console.error('Error deleting order', error);
          Alert.alert('Error', 'Failed to delete order.');
        }
      }},
    ]);
  };

  const openOrderModal = (order?: Order) => {
    if (order) {
      setCurrentOrder({
        ...order,
        designIds: order.designIds || [],
      });
      setSelectedClientForOrder({ id: order.clientId, name: order.clientName });
      loadClientSpecificData(order.clientId);
    } else {
      setCurrentOrder(initialOrderState);
      setSelectedClientForOrder(null);
      setClientDesigns([]); // Clear previous client's data
      setClientMeasurements([]); // Clear previous client's data
    }
    setIsOrderModalVisible(true);
  };

  const selectClientForOrder = (client) => {
    setSelectedClientForOrder(client);
    setCurrentOrder(prev => ({ ...prev, clientId: client.id, clientName: client.name }));
    setIsClientSelectionVisible(false);
    loadClientSpecificData(client.id); // Load designs and measurements for selected client
  };

  const pickAndLinkDesignImage = async () => {
    if (!selectedClientForOrder) {
      Alert.alert('Select Client First', 'Please select a client before uploading a photo.');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert('Permission to access gallery is required!');
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

        const sessions = await StorageService.loadAllSessions();
        const clientSession = sessions.find(s => s.id === selectedClientForOrder.id);
        
        if (clientSession) {
          const newDesign = {
            id: `design_${Date.now()}`,
            imageUri: newUri,
            savedAt: new Date().toISOString(),
          };
          clientSession.designs = clientSession.designs || [];
          clientSession.designs.push(newDesign);
          
          await StorageService.setItem('@boutique_sessions', sessions);
          
          setClientDesigns(prev => [...prev, newDesign]);
          
          setCurrentOrder(prev => ({
            ...prev,
            designIds: [...prev.designIds, newDesign.id]
          }));
        }
      } catch (error) {
        console.error('Error adding photo as design', error);
        Alert.alert('Error', 'Failed to upload photo.');
      }
    }
  };

  const shareOrderOnWhatsApp = (order: Order) => {
    const client = clients.find((c: any) => c.id === order.clientId);
    const phone = client?.phone || '';
    
    const message = `Hello ${order.clientName},\n\nHere are your order details from ${boutiqueInfo.name || 'our Boutique'}:\n\n` +
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

  const exportOrdersToCSV = async () => {
    try {
      if (orders.length === 0) {
        Alert.alert('No Orders', 'There are no orders to export.');
        return;
      }

      // CSV Header
      const header = 'Order ID,Client Name,Order Date,Delivery Date,Total Value,Advance Paid,Status,Notes\n';
      const csvContent = orders.map(o => {
        const safeNotes = o.notes ? `"${o.notes.replace(/"/g, '""')}"` : '""';
        return `${o.id},"${o.clientName}",${o.orderDate},${o.deliveryDate},${o.totalValue || 0},${o.advancePaid || 0},${o.status},${safeNotes}`;
      }).join('\n');

      const fileUri = FileSystem.documentDirectory + 'Boutique_Orders_Export.csv';
      await FileSystem.writeAsStringAsync(fileUri, header + csvContent, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export Orders' });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Export Error:', error);
      Alert.alert('Export Failed', 'Failed to export orders.');
    }
  };

  const importOrdersFromCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const fileContent = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

      const lines = fileContent.split('\n');
      if (lines.length < 2) {
        Alert.alert('Invalid CSV', 'The CSV file appears to be empty or improperly formatted.');
        return;
      }

      const sessions = await StorageService.loadAllSessions();
      let importedCount = 0;

      // Loop through lines, skipping header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Splitting by comma, ignoring commas inside double quotes
        const fields = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(f => f.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        if (fields.length < 8) continue;

        const [id, clientName, orderDate, deliveryDate, totalValue, advancePaid, status, notes] = fields;
        if (!clientName) continue;

        let clientSession = sessions.find(s => s.name.toLowerCase() === clientName.toLowerCase());
        if (!clientSession) {
          // Create a new client automatically if they don't exist
          clientSession = { id: `session_${Date.now()}_${Math.random()}`, name: clientName, orders: [], designs: [], measurements: [] };
          sessions.push(clientSession);
        }
        clientSession.orders = clientSession.orders || [];

        const existingOrderIndex = clientSession.orders.findIndex(o => o.id === id);
        const importedOrder: Order = {
          id: id || `order_${Date.now()}_${i}`,
          clientId: clientSession.id,
          clientName: clientSession.name,
          orderDate: orderDate || new Date().toISOString().split('T')[0],
          deliveryDate: deliveryDate || '',
          totalValue: totalValue || '0',
          advancePaid: advancePaid || '0',
          status: (status as any) || 'pending',
          notes: notes || '',
          designIds: [],
          measurementTimestamp: ''
        };

        if (existingOrderIndex >= 0) {
          clientSession.orders[existingOrderIndex] = { ...clientSession.orders[existingOrderIndex], ...importedOrder };
        } else {
          clientSession.orders.push(importedOrder);
          importedCount++;
        }
      }

      await StorageService.setItem('@boutique_sessions', sessions);
      loadOrders();
      loadClients();
      Alert.alert('Import Success', `${importedCount} orders were successfully imported.`);
    } catch (error) {
      console.error('Import Error:', error);
      Alert.alert('Import Failed', 'Failed to read or parse the CSV file.');
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderItem} onPress={() => openOrderModal(item)}>
      <View style={styles.orderInfo}>
        <Text style={styles.orderTitle}>Order ID: {item.id.substring(0, 8)}...</Text>
        <Text style={styles.orderClient}>Client: {item.clientName}</Text>
        <Text style={styles.orderDate}>Order Date: {new Date(item.orderDate).toLocaleDateString()}</Text>
        <Text style={styles.orderDate}>Delivery Date: {new Date(item.deliveryDate).toLocaleDateString()}</Text>
        <Text style={styles.orderDate}>Total: ₹{item.totalValue || '0'} | Balance: ₹{(parseFloat(item.totalValue || '0') - parseFloat(item.advancePaid || '0')).toFixed(2)}</Text>
        <Text style={styles.orderStatus}>Status: {item.status.replace(/_/g, ' ')}</Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.shareBtn} onPress={() => shareOrderOnWhatsApp(item)}>
          <Ionicons name="logo-whatsapp" size={16} color="white" />
          <Text style={styles.shareTxt}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteOrder(item.id, item.clientId)}>
          <Text style={styles.deleteTxt}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          {boutiqueInfo.iconUri && <Image source={{ uri: boutiqueInfo.iconUri }} style={styles.boutiqueIcon} contentFit="cover" />}
          <Text style={styles.header}>{boutiqueInfo.name} - Orders</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={async () => {
          await auth().signOut();
        }}>
          <Ionicons name="log-out-outline" size={24} color="#ff4444" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addOrderBtn} onPress={() => openOrderModal()}>
        <Ionicons name="add-circle-outline" size={20} color="white" style={{ marginRight: 8 }} />
        <Text style={styles.addOrderTxt}>Create New Order</Text>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]} onPress={exportOrdersToCSV}>
          <Ionicons name="download-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnTxt}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff9800' }]} onPress={importOrdersFromCSV}>
          <Ionicons name="push-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={styles.actionBtnTxt}>Import CSV</Text>
        </TouchableOpacity>
      </View>

      {orders.length === 0 ? (
        <Text style={styles.emptyText}>No orders found.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
        />
      )}

      {/* Order Creation/Edit Modal */}
      <Modal visible={isOrderModalVisible} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            <Text style={styles.modalHeaderTitle}>{currentOrder.id ? 'Edit Order' : 'Create New Order'}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Total Order Value (₹):</Text>
              <TextInput
                style={styles.formInput}
                value={currentOrder.totalValue}
                onChangeText={(text) => setCurrentOrder(prev => ({ ...prev, totalValue: text }))}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Advance Paid (₹):</Text>
              <View style={styles.rowInputContainer}>
                <TextInput
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  value={currentOrder.advancePaid}
                  onChangeText={(text) => setCurrentOrder(prev => ({ ...prev, advancePaid: text }))}
                  placeholder="0.00"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <TouchableOpacity 
                  style={styles.upiBtn} 
                  onPress={async () => {
                    const amount = parseFloat(currentOrder.advancePaid || '0');
                    if (isNaN(amount) || amount <= 0) {
                      Alert.alert('Invalid', 'Please enter an advance amount to collect.');
                      return;
                    }
                    const upiAccount = boutiqueInfo.upiId || 'boutique@upi';
                    const upiUrl = `upi://pay?pa=${upiAccount}&pn=${encodeURIComponent(boutiqueInfo.name || 'Boutique')}&am=${amount}&cu=INR`;
                    try {
                      const supported = await Linking.canOpenURL(upiUrl);
                      if (supported) {
                        await Linking.openURL(upiUrl);
                      } else {
                        Alert.alert('Notice', 'No UPI app found on this device. Advance recorded locally.');
                      }
                    } catch (e) {
                      Alert.alert('Error', 'Failed to launch UPI application.');
                    }
                  }}
                >
                  <Ionicons name="send-outline" size={18} color="white" style={{ marginRight: 4 }} />
                  <Text style={styles.btnTxt}>App</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.upiBtn, { backgroundColor: '#1e88e5' }]} 
                  onPress={() => {
                    const amount = parseFloat(currentOrder.advancePaid || '0');
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
              </View>
            </View>

            {currentOrder.totalValue ? (
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: '#89CFF0', fontWeight: 'bold' }]}>
                  Remaining Balance: ₹ {
                    (parseFloat(currentOrder.totalValue || '0') - parseFloat(currentOrder.advancePaid || '0')).toFixed(2)
                  }
                </Text>
              </View>
            ) : null}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Client:</Text>
              <TouchableOpacity style={styles.selectClientButton} onPress={() => setIsClientSelectionVisible(true)}>
                <Text style={styles.selectClientButtonText}>
                  {selectedClientForOrder ? selectedClientForOrder.name : 'Select Client'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Order Date:</Text>
              <TextInput
                style={styles.formInput}
                value={currentOrder.orderDate}
                onChangeText={(text) => setCurrentOrder(prev => ({ ...prev, orderDate: text }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Delivery Date:</Text>
              <TextInput
                style={styles.formInput}
                value={currentOrder.deliveryDate}
                onChangeText={(text) => setCurrentOrder(prev => ({ ...prev, deliveryDate: text }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Status:</Text>
              <TextInput
                style={styles.formInput}
                value={currentOrder.status}
                onChangeText={(text) => setCurrentOrder(prev => ({ ...prev, status: text as Order['status'] }))}
                placeholder="pending, in_progress, completed, etc."
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes:</Text>
              <TextInput
                style={styles.formInput}
                value={currentOrder.notes}
                onChangeText={(text) => setCurrentOrder(prev => ({ ...prev, notes: text }))}
                placeholder="Any special instructions..."
                placeholderTextColor="#999"
                multiline
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Linked Designs:</Text>
              <View style={styles.designButtonsContainer}>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, marginTop: 0 }]}
                  onPress={() => {
                    if (!selectedClientForOrder) {
                      Alert.alert('Select Client First', 'Please select a client before linking designs.');
                      return;
                    }
                    setIsDesignSelectionVisible(true);
                  }}
                >
                  <Text style={styles.selectButtonText}>
                    {currentOrder.designIds.length > 0 ? `${currentOrder.designIds.length} Selected` : 'Select Saved'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.selectButton, { flex: 1, marginTop: 0, backgroundColor: '#6200ee', borderColor: '#6200ee' }]}
                  onPress={pickAndLinkDesignImage}
                >
                  <Text style={styles.selectButtonText}>+ Upload Photo</Text>
                </TouchableOpacity>
              </View>
              {currentOrder.designIds.length > 0 && (
                <View style={styles.selectedDesignsContainer}>
                  {currentOrder.designIds.map(id => {
                    const design = clientDesigns.find((d: any) => d.id === id);
                    if (!design) return null;
                    return (
                      <TouchableOpacity 
                        key={id} 
                        style={styles.designCanvasSmall}
                        onPress={() => {
                          setSelectedDesignForView(design);
                          setIsDesignViewerVisible(true);
                        }}
                      >
                        {design.imageUri ? (
                          <Image source={{ uri: design.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <Svg height="100%" width="100%" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
                            {design.paths?.map((pathData: any, index: number) => {
                              const isString = typeof pathData === 'string';
                              const d = isString ? pathData : pathData.d;
                              const strokeColor = isString ? (design.color || 'black') : (pathData.color || 'black');
                              return <Path key={index} d={d} stroke={strokeColor} strokeWidth="25" fill="none" />
                            })}
                          </Svg>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Linked Measurement Set:</Text>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => {
                  if (!selectedClientForOrder) {
                    Alert.alert('Select Client First', 'Please select a client before linking measurements.');
                    return;
                  }
                  setIsMeasurementSelectionVisible(true);
                }}>
                <Text style={styles.selectButtonText}>
                  {currentOrder.measurementTimestamp ? `Selected: ${new Date(currentOrder.measurementTimestamp).toLocaleDateString()}` : 'Select Measurement Set'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsOrderModalVisible(false)}>
                <Ionicons name="close-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.btnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={onSaveOrder}>
                <Ionicons name="checkmark-outline" size={20} color="white" style={{ marginRight: 6 }} />
                <Text style={styles.btnTxt}>Save Order</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Client Selection Modal (reused from other tabs) */}
          <ClientSelectionModal
            visible={isClientSelectionVisible}
            clients={clients}
            onSelect={selectClientForOrder}
            onCancel={() => setIsClientSelectionVisible(false)}
          />

          {/* Design Selection Modal */}
          <Modal visible={isDesignSelectionVisible} animationType="slide">
            <SafeAreaView style={styles.modalContainer}>
              <Text style={styles.modalHeaderTitle}>Select Designs</Text>
              <FlatList
                data={clientDesigns}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.selectionItem,
                      currentOrder.designIds.includes(item.id) && styles.selectedSelectionItem,
                    ]}
                    onPress={() => {
                      setCurrentOrder(prev => {
                        const newDesignIds = prev.designIds.includes(item.id)
                          ? prev.designIds.filter(id => id !== item.id)
                          : [...prev.designIds, item.id];
                        return { ...prev, designIds: newDesignIds };
                      });
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={styles.selectionItemText}>Design: {new Date(item.savedAt).toLocaleDateString()}</Text>
                        <Text style={styles.selectionItemTextSmall}>{item.imageUri ? 'Reference Image' : `Paths: ${item.paths?.length || 0}`}</Text>
                      </View>
                      <View style={styles.designCanvas}>
                        {item.imageUri ? (
                          <Image source={{ uri: item.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                        ) : (
                          <Svg height="100%" width="100%" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
                            {item.paths?.map((pathData: any, index: number) => {
                              const isString = typeof pathData === 'string';
                              const d = isString ? pathData : pathData.d;
                              const strokeColor = isString ? (item.color || 'black') : (pathData.color || 'black');
                              return (
                                <Path key={index} d={d} stroke={strokeColor} strokeWidth="25" fill="none" />
                              );
                            })}
                          </Svg>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No designs for this client.</Text>}
              />
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.submitBtn} onPress={() => setIsDesignSelectionVisible(false)}>
                  <Ionicons name="checkmark-outline" size={20} color="white" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTxt}>Done</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Measurement Selection Modal */}
          <Modal visible={isMeasurementSelectionVisible} animationType="slide">
            <SafeAreaView style={styles.modalContainer}>
              <Text style={styles.modalHeaderTitle}>Select Measurement Set</Text>
              <FlatList
                data={clientMeasurements}
                keyExtractor={(item, index) => item.timestamp + (item.field ? '_' + item.field : '_' + index)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.selectionItem,
                      currentOrder.measurementTimestamp === item.timestamp && styles.selectedSelectionItem,
                    ]}
                    onPress={() => {
                      setCurrentOrder(prev => ({ ...prev, measurementTimestamp: item.timestamp }));
                      setIsMeasurementSelectionVisible(false); // Single selection, close modal
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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsMeasurementSelectionVisible(false)}>
                  <Ionicons name="close-outline" size={20} color="white" style={{ marginRight: 6 }} />
                  <Text style={styles.btnTxt}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* Design Viewer Modal */}
          <Modal visible={isDesignViewerVisible} animationType="fade" transparent={true} onRequestClose={() => setIsDesignViewerVisible(false)}>
            <View style={styles.designViewerContainer}>
              {selectedDesignForView && (
                <>
                  <View style={styles.fullDesignCanvas}>
                    {selectedDesignForView.imageUri ? (
                      <Image source={{ uri: selectedDesignForView.imageUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                    ) : (
                      <Svg height="100%" width="100%" viewBox="0 0 2000 2000" preserveAspectRatio="xMidYMid meet">
                        {selectedDesignForView.paths?.map((pathData: any, index: number) => {
                          const isString = typeof pathData === 'string';
                          const d = isString ? pathData : pathData.d;
                          const strokeColor = isString ? (selectedDesignForView.color || 'black') : (pathData.color || 'black');
                          return <Path key={index} d={d} stroke={strokeColor} strokeWidth="10" fill="none" />
                        })}
                      </Svg>
                    )}
                  </View>
                  <TouchableOpacity style={styles.closeViewerButton} onPress={() => setIsDesignViewerVisible(false)}>
                    <Text style={styles.closeViewerButtonText}>Close Preview</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Modal>

          {/* QR Code Modal */}
          <Modal visible={isQrModalVisible} animationType="fade" transparent={true} onRequestClose={() => setIsQrModalVisible(false)}>
            <View style={styles.qrModalContainer}>
              <View style={styles.qrModalContent}>
                <Text style={styles.qrModalTitle}>Scan to Pay</Text>
                <View style={styles.qrCodeWrapper}>
                  {qrCodeValue ? <QRCode value={qrCodeValue} size={200} /> : null}
                </View>
                <Text style={styles.qrModalAmount}>Amount: ₹{currentOrder.advancePaid}</Text>
                <Text style={styles.qrModalUpiId}>{boutiqueInfo.upiId}</Text>
                <TouchableOpacity style={styles.closeViewerButton} onPress={() => setIsQrModalVisible(false)}>
                  <Text style={styles.closeViewerButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  logoutBtn: { padding: 5 },
  boutiqueIcon: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  header: { fontSize: 20, fontWeight: 'bold', color: 'white', flexShrink: 1 },
  addOrderBtn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, marginBottom: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  addOrderTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 20 },
  actionBtn: { flex: 1, padding: 12, borderRadius: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionBtnTxt: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  emptyText: { color: '#ccc', textAlign: 'center', marginTop: 20, fontSize: 16 },
  orderItem: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderInfo: { flex: 1 },
  orderTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  orderClient: { fontSize: 14, color: '#ccc' },
  orderDate: { fontSize: 14, color: '#ccc' },
  orderStatus: { fontSize: 14, color: '#89CFF0', fontWeight: 'bold', marginTop: 5 },
  actionButtons: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  deleteBtn: { backgroundColor: '#ff4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 5 },
  deleteTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  shareBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareTxt: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 4 },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#1a1a1a', padding: 20 },
  modalScrollContent: { flexGrow: 1, paddingBottom: 20 },
  modalHeaderTitle: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 20, textAlign: 'center' },
  formGroup: { marginBottom: 15 },
  formLabel: { fontSize: 16, color: 'white', marginBottom: 5 },
  formInput: {
    backgroundColor: '#333',
    color: 'white',
    padding: 10,
    borderRadius: 5,
    fontSize: 16,
  },
  selectClientButton: {
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  rowInputContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  upiBtn: {
    backgroundColor: '#25D366', // WhatsApp/UPI Green
    paddingHorizontal: 15,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectClientButtonText: {
    color: 'white',
    fontSize: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  cancelBtn: { backgroundColor: '#444', padding: 15, borderRadius: 10, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  // Reused client selection modal styles
  clientItem: { backgroundColor: '#2a2a2a', padding: 15, marginBottom: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  clientName: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  clientPhone: { fontSize: 14, color: '#ccc' },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#ccc' },
  selectButton: {
    backgroundColor: '#444',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 5,
  },
  selectButtonText: {
    color: 'white',
    fontSize: 16,
  },
  designButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  selectedItemsText: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  selectionItem: {
    backgroundColor: '#333',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#555',
  },
  selectedSelectionItem: {
    borderColor: '#89CFF0',
    borderWidth: 2,
  },
  selectionItemText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  selectionItemTextSmall: { color: '#ccc', fontSize: 12 },
  designCanvas: {
    width: 60,
    height: 60,
    backgroundColor: '#fff',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#444',
  },
  selectedDesignsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 10,
    justifyContent: 'center',
  },
  designCanvasSmall: {
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#444',
  },
  designViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullDesignCanvas: {
    width: '100%',
    height: '70%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  closeViewerButton: {
    backgroundColor: '#6200ee',
    padding: 15,
    borderRadius: 10,
    minWidth: 150,
    alignItems: 'center',
  },
  closeViewerButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
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
});