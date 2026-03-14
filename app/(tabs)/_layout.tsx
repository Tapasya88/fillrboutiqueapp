import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { Redirect, Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(user => {
      setIsAuthenticated(!!user);
    });

    // Unsubscribe on unmount
    return subscriber;
  }, []);

  if (isAuthenticated === null) {
    return <View style={{ flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center' }}><ActivityIndicator size="large" color="#6200ee" /></View>;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopWidth: 1,
          borderTopColor: '#333',
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 5,
          height: 55 + Math.max(insets.bottom, 10),
          elevation: 0, // Removes shadow on Android
          shadowOpacity: 0, // Removes shadow on iOS
        },
        tabBarActiveTintColor: '#6200ee',
        tabBarInactiveTintColor: '#999',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
          marginBottom: 3,
        },
      }}>
      <Tabs.Screen
        name="measurements"
        options={{
          title: 'Measure',
          tabBarIcon: ({ color }) => <Ionicons name="body-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sketch"
        options={{
          title: 'Sketch',
          tabBarIcon: ({ color }) => <Ionicons name="brush-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color }) => <Ionicons name="images-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Customers',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />

      {/* Hide the default Expo starter tabs from the bottom bar */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
