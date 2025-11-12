import { useEffect, useState } from 'react';
import { Button, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dsp, command } from '../api/dspClient';

export default function Controls() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setError(null);
      setStatus(await dsp.status());
    } catch (e) {
      setStatus(null);
      setError(String(e));
    }
  }

  useEffect(() => { load(); }, []);

  async function nudge(delta) {
    const v = Math.max(0, Math.min(1, ((status?.volume ?? 0.5) + delta)));
    await dsp.setVolume(v);
    load();
  }

  async function handleCommand(action, args = {}) {
    try {
      setLoading(true);
      setError(null);
      await command(action, args);
      // Refresh status after command
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 20 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>Controls</Text>

        {error && (
          <Text style={{ color: '#a00', padding: 10, backgroundColor: '#fee', borderRadius: 8 }}>
            ❌ {error}
          </Text>
        )}

        {status ? (
          <View style={{ gap: 16 }}>
            {/* Volume Control */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '600' }}>Volume</Text>
              <Text>Current: {Math.round((status.volume || 0) * 100)}%</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Button title="-10%" onPress={() => nudge(-0.1)} disabled={loading} />
                <Button title="-5%" onPress={() => nudge(-0.05)} disabled={loading} />
                <Button title="+5%" onPress={() => nudge(+0.05)} disabled={loading} />
                <Button title="+10%" onPress={() => nudge(+0.1)} disabled={loading} />
              </View>
            </View>

            {/* Command Controls */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 18, fontWeight: '600' }}>Commands</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button 
                    title="Mute" 
                    onPress={() => handleCommand('mute')} 
                    disabled={loading}
                  />
                  <Button 
                    title="Unmute" 
                    onPress={() => handleCommand('unmute')} 
                    disabled={loading}
                  />
                  <Button 
                    title="Toggle Mute" 
                    onPress={() => handleCommand('toggleMute')} 
                    disabled={loading}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button 
                    title="Power On" 
                    onPress={() => handleCommand('power', { state: true })} 
                    disabled={loading}
                  />
                  <Button 
                    title="Power Off" 
                    onPress={() => handleCommand('power', { state: false })} 
                    disabled={loading}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button 
                    title="Input 1" 
                    onPress={() => handleCommand('setInput', { input: 1 })} 
                    disabled={loading}
                  />
                  <Button 
                    title="Input 2" 
                    onPress={() => handleCommand('setInput', { input: 2 })} 
                    disabled={loading}
                  />
                  <Button 
                    title="Input 3" 
                    onPress={() => handleCommand('setInput', { input: 3 })} 
                    disabled={loading}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button 
                    title="Preset 1" 
                    onPress={() => handleCommand('loadPreset', { preset: 1 })} 
                    disabled={loading}
                  />
                  <Button 
                    title="Preset 2" 
                    onPress={() => handleCommand('loadPreset', { preset: 2 })} 
                    disabled={loading}
                  />
                  <Button 
                    title="Preset 3" 
                    onPress={() => handleCommand('loadPreset', { preset: 3 })} 
                    disabled={loading}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button 
                    title="Reset" 
                    onPress={() => handleCommand('reset')} 
                    disabled={loading}
                  />
                  <Button 
                    title="Refresh" 
                    onPress={load} 
                    disabled={loading}
                  />
                </View>
              </View>
            </View>

            {/* Status Info */}
            <View style={{ gap: 6, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>Status</Text>
              {status.device && <Text>Device: {status.device}</Text>}
              {status.uptime && <Text>Uptime: {(status.uptime / 1000).toFixed(1)}s</Text>}
              {status.input !== undefined && <Text>Input: {status.input}</Text>}
              {status.muted !== undefined && <Text>Muted: {status.muted ? 'Yes' : 'No'}</Text>}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', padding: 20 }}>
            {loading ? (
              <ActivityIndicator size="large" />
            ) : (
              <Text>Loading…</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
