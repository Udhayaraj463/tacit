import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Notice the path matches your exact folder structure
import { CounterConversationScreen } from './claude src/src/screens/CounterConversationScreen';

const API_BASE_URL = 'https://tacit-77cd.onrender.com';

export default function App() {
  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <CounterConversationScreen />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    minHeight: '100%',
    width: '100%',
  },
});