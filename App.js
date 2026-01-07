import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StatusScreen from './screens/Status';
import ControlsScreen from './screens/Controls';
import Grundig1Screen from './screens/grundig1';
import { Grundig1Provider } from './screens/grundig1/state/grundig1Store';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <Grundig1Provider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Status">
          <Stack.Screen name="Status" component={StatusScreen} />
          <Stack.Screen name="Controls" component={ControlsScreen} />
          <Stack.Screen 
            name="Grundig1" 
            component={Grundig1Screen}
            options={{ 
              headerShown: false,
              gestureEnabled: false,
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </Grundig1Provider>
  );
}
