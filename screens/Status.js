// src/screens/StatusScreen.js
import { useEffect, useState } from 'react';
import { Button, Text, TextInput, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dsp, syncFromArduino } from '../api/dspClient';
import { useGrundig1Store } from './grundig1/state/grundig1Store';
import LidLightCard from '../components/LidLightCard';

export default function Status({ navigation }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const { state: grundigState, dispatch, actions } = useGrundig1Store();
  const currentSource = grundigState?.global?.source || 'turntable';
  const passwordLocked = grundigState?.global?.passwordLocked || false;
  const lockCode = grundigState?.global?.lockCode || '';

  useEffect(() => {
    let ws;
    (async () => {
      const u = await dsp.getBaseUrl();
      setUrl(u);
      await refresh();
      // Try WS if available (optional)
      ws = dsp.connectWs(setStatus);
    })();
    return () => { if (ws) ws.close(); };
  }, []);

  async function refresh() {
    try {
      setErr(null);
      const s = await dsp.status();
      setStatus(s);
    } catch (e) {
      setErr(String(e));
      setStatus(null);
    }
  }

  async function saveUrl() {
    await dsp.setBaseUrl(url);
    refresh();
  }

  async function handleSourceChange(newSource) {
    if (sourceLoading || newSource === currentSource) return;
    
    setSourceLoading(true);
    try {
      // Call API to change source on ESP32
      await dsp.setSource(newSource, lockCode);
      
      // Sync from Arduino to get confirmed state
      const freshState = await syncFromArduino();
      if (freshState) {
        dispatch({ type: actions.SYNC_FROM_ARDUINO, state: freshState });
      } else {
        // Fallback: just update local state
        dispatch({ type: actions.SET_SOURCE, source: newSource });
      }
    } catch (e) {
      setErr(`Failed to change source: ${e.message}`);
    } finally {
      setSourceLoading(false);
    }
  }

  function handleLockCodeChange(code) {
    dispatch({ type: actions.SET_LOCK_CODE, code });
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1, padding: 20 }} contentContainerStyle={{ gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Console Controller</Text>

        <View style={{ gap: 8 }}>
          <Text>Device URL</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="http://192.168.x.x"
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          />
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
            <Button title="Save URL" onPress={saveUrl} />
            <Button title="Refresh" onPress={refresh} />
            <Button title="Controls →" onPress={() => navigation.navigate('Controls')} />
            <Button title="Grundig1 Console →" onPress={() => navigation.navigate('Grundig1')} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontWeight: '600' }}>Device Lock Code</Text>
            <Text style={{ fontSize: 12, color: passwordLocked ? '#f80' : '#666' }}>
              ({passwordLocked ? 'Locked' : 'Unlocked'})
            </Text>
          </View>
          <TextInput
            value={lockCode}
            onChangeText={handleLockCodeChange}
            keyboardType="numeric"
            maxLength={6}
            placeholder="Enter 6-digit code"
            secureTextEntry
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          />
          <Text style={{ fontSize: 12, color: '#666' }}>
            Required for locked device operations
          </Text>
        </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>Input Source</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => handleSourceChange('turntable')}
            disabled={sourceLoading}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: currentSource === 'turntable' ? '#007AFF' : '#E5E5EA',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: currentSource === 'turntable' ? '#FFF' : '#000',
                fontWeight: '600',
              }}
            >
              Turntable
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleSourceChange('bluetooth')}
            disabled={sourceLoading}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: currentSource === 'bluetooth' ? '#007AFF' : '#E5E5EA',
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: currentSource === 'bluetooth' ? '#FFF' : '#000',
                fontWeight: '600',
              }}
            >
              Bluetooth
            </Text>
          </TouchableOpacity>
        </View>
        {sourceLoading && <Text style={{ fontSize: 12, color: '#666' }}>Switching source...</Text>}
      </View>

      <LidLightCard
        passwordLocked={passwordLocked}
        lockCode={lockCode}
      />

      {status ? (
        <View style={{ gap: 6 }}>
          <Text>Device: {status.device}</Text>
          <Text>Uptime: {(status.uptime / 1000).toFixed(1)} s</Text>
          {'volume' in status && <Text>Volume: {Math.round((status.volume || 0) * 100)}%</Text>}
        </View>
      ) : (
        <Text style={{ color: '#a00' }}>{err ? `❌ ${err}` : 'Connecting…'}</Text>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}
