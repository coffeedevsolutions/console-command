import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StatusScreen from './screens/Status';
import ControlsScreen from './screens/Controls';
import Grundig1Screen from './screens/grundig1';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
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
  );
}
