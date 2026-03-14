import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'Designer' });
  const [boutiqueName, setBoutiqueName] = useState('');
  const [boutiqueIconUri, setBoutiqueIconUri] = useState<string | null>(null);
  const [upiId, setUpiId] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [financials, setFinancials] = useState({ total: 0, paid: 0, pending: 0 });

  // State variables for section expansion
  const [isFinanceExpanded, setIsFinanceExpanded] = useState(true);
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);
  const [isAiExpanded, setIsAiExpanded] = useState(false);
  const [isUserFormExpanded, setIsUserFormExpanded] = useState(false);
  const [isTeamExpanded, setIsTeamExpanded] = useState(true);

  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      loadUsers();
      loadBoutiqueProfile();
      loadFinancials();
    }, [])
  );

  const loadBoutiqueProfile = async () => {
    try {
      const info = await AsyncStorage.getItem('@boutique_profile');
      if (info) {
        const parsed = JSON.parse(info);
        setBoutiqueName(parsed.name || '');
        setBoutiqueIconUri(parsed.iconUri || null);
        setUpiId(parsed.upiId || '');
      }
      const key = await AsyncStorage.getItem('@boutique_hf_key');
      if (key) setOpenAiKey(key);
    } catch (e) {
      console.warn('Failed to load boutique profile', e);
    }
  };

  const loadFinancials = async () => {
    try {
      const sessions = await StorageService.loadAllSessions();
      let total = 0;
      let paid = 0;
      sessions.forEach((session: any) => {
        if (session.orders) {
          session.orders.forEach((order: any) => {
            total += parseFloat(order.totalValue) || 0;
            paid += parseFloat(order.advancePaid) || 0;
          });
        }
      });
      setFinancials({ total, paid, pending: total - paid });
    } catch (e) {
      console.error('Failed to load financials', e);
    }
  };

  const loadUsers = async () => {
    try {
      const usersSnapshot = await firestore().collection('users').get();
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);
    } catch (e) {
      console.error('Failed to load users', e);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name || !newUser.username || !newUser.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      const userCredential = await auth().createUserWithEmailAndPassword(newUser.username, newUser.password);
      const uid = userCredential.user.uid;

      // Store additional user info (like role) in Firestore
      await firestore().collection('users').doc(uid).set({
        name: newUser.name,
        email: newUser.username,
        role: newUser.role,
      });

      setNewUser({ name: '', username: '', password: '', role: 'Designer' });
      Alert.alert('Success', 'User created successfully!');
      loadUsers(); // Refresh user list
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'That email address is already in use!');
      } else if (error.code === 'auth/invalid-email') {
        Alert.alert('Error', 'That email address is invalid!');
      } else {
        Alert.alert('Error', error.message);
      }
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.name}</Text>
        <Text style={styles.userDetails}>{item.email} • {item.role}</Text>
      </View>
      {/* Deleting users from the client is a privileged operation. It's safer to do this from the Firebase Console. */}
    </View>
  );

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
        setBoutiqueIconUri(newUri);
      } catch (error) {
        Alert.alert('Error', 'Failed to save icon.');
      }
    }
  };

  const saveBoutiqueProfile = async () => {
    if (!boutiqueName.trim()) {
      Alert.alert('Required', 'Please enter a boutique name.');
      return;
    }
    const profile = { name: boutiqueName, iconUri: boutiqueIconUri, upiId: upiId.trim() };
    await AsyncStorage.setItem('@boutique_profile', JSON.stringify(profile));
    Alert.alert('Success', 'Boutique profile updated successfully.');
  };

  const saveAiKey = async () => {
    try {
      await AsyncStorage.setItem('@boutique_hf_key', openAiKey.trim());
      Alert.alert('Success', 'Hugging Face API Key saved successfully.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save API key.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ListHeaderComponent={
          <>
            <View style={styles.headerRow}>
              <View style={styles.headerTitleContainer}>
                {boutiqueIconUri && <Image source={{ uri: boutiqueIconUri }} style={styles.boutiqueIcon} contentFit="cover" />}
                <Text style={styles.header}>{boutiqueName || 'Admin'} - Settings</Text>
              </View>
              <TouchableOpacity style={styles.logoutBtn} onPress={async () => {
                await auth().signOut();
                // The onAuthStateChanged listener in _layout will handle the redirect.
              }}>
                <Ionicons name="log-out-outline" size={24} color="#ff4444" />
              </TouchableOpacity>
            </View>

            <View style={styles.formCard}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => setIsFinanceExpanded(!isFinanceExpanded)}>
                <Text style={styles.formTitle}>Financial Overview</Text>
                <Ionicons name={isFinanceExpanded ? "chevron-up" : "chevron-down"} size={20} color="white" />
              </TouchableOpacity>
              {isFinanceExpanded && (
                <View style={styles.cardContent}>
                  <View style={styles.financeRow}>
                    <View style={styles.financeBox}>
                      <Text style={styles.financeLabel}>Total Value</Text>
                      <Text style={styles.financeAmount}>₹{financials.total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.financeBox}>
                      <Text style={styles.financeLabel}>Paid</Text>
                      <Text style={[styles.financeAmount, { color: '#4CAF50' }]}>₹{financials.paid.toFixed(2)}</Text>
                    </View>
                    <View style={styles.financeBox}>
                      <Text style={styles.financeLabel}>Pending</Text>
                      <Text style={[styles.financeAmount, { color: '#ff4444' }]}>₹{financials.pending.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.formCard}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => setIsProfileExpanded(!isProfileExpanded)}>
                <Text style={styles.formTitle}>Boutique Profile</Text>
                <Ionicons name={isProfileExpanded ? "chevron-up" : "chevron-down"} size={20} color="white" />
              </TouchableOpacity>
              {isProfileExpanded && (
                <View style={styles.cardContent}>
                  <View style={styles.profileFormRow}>
                    <TouchableOpacity style={styles.iconUploadBtn} onPress={pickBoutiqueIcon}>
                      {boutiqueIconUri ? (
                        <Image source={{ uri: boutiqueIconUri }} style={styles.setupIconPreview} contentFit="cover" />
                      ) : (
                        <Ionicons name="camera-outline" size={30} color="white" />
                      )}
                    </TouchableOpacity>
                    <View style={styles.profileInputs}>
                      <TextInput
                        style={styles.input}
                        placeholder="Boutique Name"
                        placeholderTextColor="#999"
                        value={boutiqueName}
                        onChangeText={setBoutiqueName}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="UPI ID (e.g. merchant@upi)"
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                        value={upiId}
                        onChangeText={setUpiId}
                      />
                      <TouchableOpacity style={styles.submitBtn} onPress={saveBoutiqueProfile}>
                        <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.submitBtnText}>Update Profile</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.formCard}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => setIsAiExpanded(!isAiExpanded)}>
                <Text style={styles.formTitle}>AI Configuration</Text>
                <Ionicons name={isAiExpanded ? "chevron-up" : "chevron-down"} size={20} color="white" />
              </TouchableOpacity>
              {isAiExpanded && (
                <View style={styles.cardContent}>
                  <TextInput
                    style={styles.input}
                    placeholder="Hugging Face API Key (hf_...)"
                    placeholderTextColor="#999"
                    secureTextEntry
                    value={openAiKey}
                    onChangeText={setOpenAiKey}
                  />
                  <TouchableOpacity style={styles.submitBtn} onPress={saveAiKey}>
                    <Ionicons name="key-outline" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Save API Key</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.formCard}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => setIsUserFormExpanded(!isUserFormExpanded)}>
                <Text style={styles.formTitle}>Create New User</Text>
                <Ionicons name={isUserFormExpanded ? "chevron-up" : "chevron-down"} size={20} color="white" />
              </TouchableOpacity>
              {isUserFormExpanded && (
                <View style={styles.cardContent}>
                  <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#999" value={newUser.name} onChangeText={(text) => setNewUser(prev => ({ ...prev, name: text }))} />
                  <TextInput style={styles.input} placeholder="Username / Email" placeholderTextColor="#999" autoCapitalize="none" value={newUser.username} onChangeText={(text) => setNewUser(prev => ({ ...prev, username: text }))} />
                  <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#999" secureTextEntry value={newUser.password} onChangeText={(text) => setNewUser(prev => ({ ...prev, password: text }))} />

                  <View style={styles.roleContainer}>
                    <Text style={styles.roleLabel}>Role Access:</Text>
                    {['Admin', 'Designer', 'Worker'].map((role) => (
                      <TouchableOpacity key={role} style={[styles.roleBtn, newUser.role === role && styles.roleBtnActive]} onPress={() => setNewUser(prev => ({ ...prev, role }))}>
                        <Text style={[styles.roleBtnText, newUser.role === role && styles.roleBtnTextActive]}>{role}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.submitBtn} onPress={handleAddUser}>
                    <Ionicons name="person-add-outline" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Create Account</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.cardHeader, { marginBottom: isTeamExpanded ? 15 : 0 }]} onPress={() => setIsTeamExpanded(!isTeamExpanded)}>
              <Text style={styles.listHeader}>Team Members</Text>
              <Ionicons name={isTeamExpanded ? "chevron-up" : "chevron-down"} size={20} color="white" />
            </TouchableOpacity>
          </>
        }
        data={isTeamExpanded ? users : []}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        ListEmptyComponent={isTeamExpanded ? <Text style={styles.emptyText}>No additional users found.</Text> : null}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  boutiqueIcon: { width: 32, height: 32, borderRadius: 16, marginRight: 10 },
  header: { fontSize: 20, fontWeight: 'bold', color: 'white', flexShrink: 1 },
  logoutBtn: { padding: 5 },
  formCard: { backgroundColor: '#2a2a2a', padding: 20, borderRadius: 12, marginBottom: 25 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardContent: { marginTop: 15 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, marginHorizontal: -4 },
  financeBox: { flex: 1, backgroundColor: '#333', padding: 15, borderRadius: 8, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  financeLabel: { color: '#aaa', fontSize: 12, marginBottom: 8 },
  financeAmount: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  profileFormRow: { flexDirection: 'row', alignItems: 'center' },
  iconUploadBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 15, borderWidth: 2, borderColor: '#555' },
  setupIconPreview: { width: '100%', height: '100%' },
  profileInputs: { flex: 1 },
  input: { backgroundColor: '#333', color: 'white', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#444' },
  roleContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 },
  roleLabel: { color: 'white', fontSize: 16, marginRight: 10 },
  roleBtn: { backgroundColor: '#444', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#555' },
  roleBtnActive: { backgroundColor: '#6200ee', borderColor: '#6200ee' },
  roleBtnText: { color: '#ccc', fontSize: 14, fontWeight: 'bold' },
  roleBtnTextActive: { color: 'white' },
  submitBtn: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  listHeader: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  userCard: { backgroundColor: '#2a2a2a', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#333' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  userDetails: { fontSize: 14, color: '#aaa' },
  emptyText: { color: '#ccc', textAlign: 'center', fontSize: 16, marginTop: 10 },
});