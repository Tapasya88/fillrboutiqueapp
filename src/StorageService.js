import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_SCHEMA_VERSION = 1;

export const StorageService = {
  // --- Data Integrity Wrappers ---
  
  safeGetItem: async (key) => {
    try {
      let value = await AsyncStorage.getItem(key);
      if (!value) {
        // Fallback to backup if primary is empty or missing
        value = await AsyncStorage.getItem(`${key}_backup`);
      }
      return value != null ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Error reading primary store', key, e);
      // Attempt to salvage from backup on parse/read error
      try {
        const backupValue = await AsyncStorage.getItem(`${key}_backup`);
        return backupValue != null ? JSON.parse(backupValue) : null;
      } catch (backupError) {
        console.error('Error reading backup store', key, backupError);
        return null;
      }
    }
  },

  setItemWithBackup: async (key, value) => {
    try {
      const jsonValue = JSON.stringify(value);
      // Write to backup first for atomic-like safety
      await AsyncStorage.setItem(`${key}_backup`, jsonValue);
      // Then overwrite primary
      await AsyncStorage.setItem(key, jsonValue);
    } catch (e) {
      console.error('Error writing to secure storage', key, e);
    }
  },

  migrateSessions: async (sessions) => {
    let migrated = false;
    const updatedSessions = sessions.map(session => {
      let updatedSession = { ...session };
      // Upgrade legacy schemas to v1
      if (!updatedSession.schemaVersion) {
        updatedSession.schemaVersion = CURRENT_SCHEMA_VERSION;
        updatedSession.orders = updatedSession.orders || [];
        updatedSession.designs = updatedSession.designs || [];
        updatedSession.measurements = updatedSession.measurements || [];
        migrated = true;
      }
      return updatedSession;
    });

    if (migrated) {
      await StorageService.setItemWithBackup('@boutique_sessions', updatedSessions);
    }
    return updatedSessions;
  },

  /**
   * Save a new client session
   */
  saveClientSession: async (clientData) => {
    try {
      let sessions = await StorageService.loadAllSessions();
      sessions.push({ ...clientData, schemaVersion: CURRENT_SCHEMA_VERSION });
      await StorageService.setItemWithBackup('@boutique_sessions', sessions);
      return true;
    } catch (e) {
      console.error("Error saving session", e);
      return false;
    }
  },

  loadAllSessions: async () => {
    try {
      let sessions = await StorageService.safeGetItem('@boutique_sessions');
      if (!sessions) return [];
      
      return await StorageService.migrateSessions(sessions);
    } catch (e) {
      console.error("Error loading sessions", e);
      return [];
    }
  },

  async getItem(key) {
    return await StorageService.safeGetItem(key);
  },

  async setItem(key, value) {
    return await StorageService.setItemWithBackup(key, value);
  }
};