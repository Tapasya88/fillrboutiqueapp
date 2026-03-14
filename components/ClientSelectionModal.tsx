import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ClientSelectionModal({
  visible,
  clients,
  onSelect,
  onCancel,
  onCreateNew,
}: {
  visible: boolean;
  clients: any[];
  onSelect: (client: any) => void;
  onCancel: () => void;
  onCreateNew?: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modalContainer}>
        <Text style={styles.modalHeaderTitle}>Select Customer</Text>
        <FlatList
          data={clients}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            const defaultAvatar = item.gender === 'male'
              ? 'https://cdn-icons-png.flaticon.com/512/2815/2815428.png'
              : 'https://cdn-icons-png.flaticon.com/512/1144/1144709.png';
            return (
              <TouchableOpacity style={styles.clientItem} onPress={() => onSelect(item)}>
                <Image 
                  source={{ uri: item.imageUri || defaultAvatar }} 
                  style={styles.clientAvatar} 
                  contentFit="cover"
                />
                <View style={styles.clientInfo}>
                  <Text style={styles.clientName}>{item.name}</Text>
                  <Text style={styles.clientPhone}>{item.phone}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>No customers found.</Text>}
        />
        <View style={styles.modalFooter}>
          {onCreateNew && (
            <TouchableOpacity style={styles.addBtn} onPress={onCreateNew}>
              <Ionicons name="add-circle-outline" size={20} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.btnTxt}>Create New</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="close-outline" size={20} color="white" style={{ marginRight: 6 }} />
            <Text style={styles.btnTxt}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, padding: 20, backgroundColor: '#1a1a1a', paddingTop: 60 },
  modalHeaderTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, color: 'white', textAlign: 'center' },
  clientItem: { backgroundColor: '#2a2a2a', padding: 15, marginBottom: 10, borderRadius: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.5, flexDirection: 'row', alignItems: 'center' },
  clientAvatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: '#444' },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  clientPhone: { fontSize: 14, color: '#ccc', marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#ccc' },
  modalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingBottom: 20 },
  addBtn: { backgroundColor: '#6200ee', padding: 15, borderRadius: 10, flex: 1, marginRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#444', padding: 15, borderRadius: 10, flex: 1, marginLeft: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnTxt: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});