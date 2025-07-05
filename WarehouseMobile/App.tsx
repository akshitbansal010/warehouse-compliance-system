import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import screens
import LoginScreen from './src/screens/LoginScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import PackoutInstructionsScreen from './src/screens/PackoutInstructionsScreen';

// Import API services
import { authAPI, tokenManager, networkUtils } from './src/services/api';

// Create stack navigator
const Stack = createStackNavigator();

// Authentication stack (for unauthenticated users)
const AuthStack = () => (
  <Stack.Navigator
    initialRouteName="Login"
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

// Main app stack (for authenticated users)
const MainStack = () => (
  <Stack.Navigator
    initialRouteName="Scanner"
    screenOptions={{
      headerStyle: {
        backgroundColor: '#3B82F6',
      },
      headerTintColor: '#FFFFFF',
      headerTitleStyle: {
        fontWeight: '600',
      },
    }}
  >
    <Stack.Screen 
      name="Scanner" 
      component={ScannerScreen}
      options={{
        title: 'Scan Order',
        headerLeft: () => null, // Disable back button
      }}
    />
    <Stack.Screen 
      name="PackoutInstructions" 
      component={PackoutInstructionsScreen}
      options={{
        title: 'Packout Instructions',
      }}
    />
  </Stack.Navigator>
);

// Main App component
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if user is already authenticated
      const isAuth = await tokenManager.isAuthenticated();
      
      if (isAuth) {
        try {
          // Verify token is still valid by fetching user data
          const userData = await authAPI.getCurrentUser();
          setUser(userData);
          setIsAuthenticated(true);
          
          // Check network connectivity and sync offline data if needed
          const isConnected = await networkUtils.checkConnectivity();
          if (isConnected) {
            await networkUtils.syncPendingData();
          }
        } catch (error) {
          console.error('Token validation failed:', error);
          // Token is invalid, clear it and show login
          await tokenManager.clearTokens();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('App initialization error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthStateChange = (authenticated: boolean, userData?: any) => {
    setIsAuthenticated(authenticated);
    setUser(userData || null);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout properly. Please try again.');
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#3B82F6" 
        translucent={false}
      />
      
      {isAuthenticated ? (
        <MainStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});

export default App;