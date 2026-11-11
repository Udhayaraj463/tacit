import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CounterConversationScreen } from './claude src/src/screens/CounterConversationScreen';

export default function App() {
  const { width, height } = useWindowDimensions();
  const [fullWindow, setFullWindow] = useState(false);

  // Show the centered mobile frame when opened on a desktop/laptop browser
  const isDesktopWeb = Platform.OS === 'web' && width >= 600;

  if (!isDesktopWeb || fullWindow) {
    return (
      <SafeAreaProvider>
        <View style={styles.fullContainer}>
          <CounterConversationScreen />
          {isDesktopWeb && fullWindow && (
            <View style={styles.floatingRestoreBar}>
              <Pressable onPress={() => setFullWindow(false)}>
                <Text style={styles.toggleLink}>切換回手機外框預覽</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  const frameHeight = Math.min(860, Math.max(640, height - 72));

  return (
    <SafeAreaProvider>
      <View style={styles.desktopBackdrop}>
        <View style={[styles.phoneBezel, { height: frameHeight }]}>
          <View style={styles.phoneScreen}>
            <CounterConversationScreen />
          </View>
        </View>

        <View style={styles.captionRow}>
          <Text style={styles.captionText}>
            這是手機上的樣子，用手機打開效果最好。{' '}
          </Text>
          <Pressable onPress={() => setFullWindow(true)}>
            <Text style={styles.toggleLink}>改成整個視窗</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: '#000000',
    minHeight: '100%',
    width: '100%',
  },
  desktopBackdrop: {
    flex: 1,
    backgroundColor: '#1E1E20',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: '100%',
    width: '100%',
  },
  phoneBezel: {
    width: 420,
    maxWidth: '100%',
    backgroundColor: '#000000',
    borderRadius: 46,
    borderWidth: 10,
    borderColor: '#0A0A0C',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
    elevation: 24,
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    overflow: 'hidden',
    borderRadius: 36,
  },
  captionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    flexWrap: 'wrap',
  },
  captionText: {
    color: '#98989F',
    fontSize: 13,
  },
  toggleLink: {
    color: '#98989F',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  floatingRestoreBar: {
    position: 'absolute',
    bottom: 8,
    right: 14,
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38383A',
  },
});