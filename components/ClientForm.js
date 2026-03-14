import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ClientForm({ visible, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Customer Details</Text>
          <TextInput style={styles.input} placeholder="Name" onChangeText={setName} />
          <TextInput style={styles.input} placeholder="WhatsApp (e.g. +1...)" onChangeText={setPhone} />
          <View style={styles.row}>
            <TouchableOpacity onPress={onCancel} style={styles.btn}><Text>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => onSave({name, phone})} style={styles.save}><Text style={{color:'#fff'}}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  container: { backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  input: { borderBottomWidth: 1, marginBottom: 15, padding: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  btn: { padding: 10 },
  save: { backgroundColor: '#6200ee', padding: 10, borderRadius: 5 }
});