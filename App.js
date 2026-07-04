import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import StatusScreen from './screens/Status';
import ControlsScreen from './screens/Controls';
import Grundig1Screen from './screens/grundig1';
import { Grundig1Provider } from './screens/grundig1/state/grundig1Store';
import { color } from './theme/tokens';

const Stack = createNativeStackNavigator();

// Dark navigation theme so there are no white flashes between screens.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.bg, card: color.bg, text: color.textHi },
};

export default function App() {
  return (
    <Grundig1Provider>
      <StatusBar style="light" />
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
            name="Grundig1"
            component={Grundig1Screen}
            options={{ gestureEnabled: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </Grundig1Provider>
  );
}
