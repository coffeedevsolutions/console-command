import { useEffect } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useKeepAwake } from 'expo-keep-awake';
import * as Updates from 'expo-updates';
import StatusScreen from './screens/Status';
import ControlsScreen from './screens/Controls';
import NowPlayingScreen from './screens/NowPlaying';
import NowSpinningScreen from './screens/NowSpinning';
import LibraryScreen from './screens/Library';
import Grundig1Screen from './screens/grundig1';
import DspConsoleScreen from './screens/dsp';
import { Grundig1Provider } from './screens/grundig1/state/grundig1Store';
import { NowPlayingProvider } from './hooks/nowPlaying';
import { NowSpinningProvider, wakeSignal } from './hooks/useNowSpinning';
import { color } from './theme/tokens';

const Stack = createNativeStackNavigator();

// Dark navigation theme so there are no white flashes between screens.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.bg, text: color.textHi },
};

export default function App() {
  useKeepAwake(); // keep the console display on while the app is open

  // Apply OTA updates promptly: check on launch, and if one is available fetch it
  // and reload into it (instead of waiting for a second manual relaunch).
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    (async () => {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch { /* offline or no update — ignore */ }
    })();
  }, []);

  return (
    <Grundig1Provider>
      <NowPlayingProvider>
      <NowSpinningProvider>
      <StatusBar hidden style="light" />
      {/* Capture (not intercept) every touch so a tap anywhere can wake Now Spinning from sleep. */}
      <View
        style={{ flex: 1 }}
        onStartShouldSetResponderCapture={() => { wakeSignal.fire(); return false; }}
      >
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          initialRouteName="Status"
          screenOptions={{
            headerShown: false,                          // no white native page headers
            contentStyle: { backgroundColor: color.bg },
          }}
        >
          <Stack.Screen name="Status" component={StatusScreen} />
          <Stack.Screen name="Controls" component={ControlsScreen} />
          <Stack.Screen
            name="NowPlaying"
            component={NowPlayingScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="NowSpinning"
            component={NowSpinningScreen}
            options={{ presentation: 'fullScreenModal', animation: 'fade' }}
          />
          <Stack.Screen
            name="Library"
            component={LibraryScreen}
            options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="Grundig1"
            component={Grundig1Screen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen
            name="DspConsole"
            component={DspConsoleScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      </View>
      </NowSpinningProvider>
      </NowPlayingProvider>
    </Grundig1Provider>
  );
}
