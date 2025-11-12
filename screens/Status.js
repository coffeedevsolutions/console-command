// src/screens/StatusScreen.js
import { useEffect, useState } from 'react';
import { Button, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dsp } from '../api/dspClient';

export default function Status({ navigation }) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState(null);

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

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}>
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

      {status ? (
        <View style={{ gap: 6 }}>
          <Text>Device: {status.device}</Text>
          <Text>Uptime: {(status.uptime / 1000).toFixed(1)} s</Text>
          {'volume' in status && <Text>Volume: {Math.round((status.volume || 0) * 100)}%</Text>}
        </View>
      ) : (
        <Text style={{ color: '#a00' }}>{err ? `❌ ${err}` : 'Connecting…'}</Text>
      )}
    </SafeAreaView>
  );
}
