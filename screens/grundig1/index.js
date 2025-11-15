import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Button, Alert, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Grundig1Provider, useGrundig1Store } from './state/grundig1Store';
import PanelFrame from './components/PanelFrame';
import FaderBank from './components/FaderBank';
import PEQControls from './components/PEQControls';
import KnobStack from './components/KnobStack';
import OutputChannelStrip from './components/OutputChannelStrip';
import CrossoverControls from './components/CrossoverControls';
import LimiterControls from './components/LimiterControls';
import DelayControl from './components/DelayControl';
import PolaritySwitch from './components/PolaritySwitch';
import RoutingMatrix from './components/RoutingMatrix';
import SequencerTools from './components/SequencerTools';
import Generators from './components/Generators';
import PresetGrid from './components/PresetGrid';
import PresetSelector from './components/PresetSelector';
import RockerSwitch from './components/RockerSwitch';
import { colors, typography, spacing } from './theme';

function Grundig1Screen() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedChannel, setSelectedChannel] = useState('ch1');
  const { state, dispatch, actions } = useGrundig1Store();

  const tabs = [
    { id: 'home', label: 'Home' },
    { id: 'input', label: 'Input' },
    { id: 'outputs', label: 'Outputs' },
    { id: 'outputChannels', label: 'Output Channels' },
    { id: 'tools', label: 'Tools' },
    { id: 'presets', label: 'Presets' },
    { id: 'settings', label: 'Settings' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <View style={styles.homeLayout}>
            {/* Left side: Fader Bank + Controls */}
            <View style={styles.leftPanel}>
              {/* Fader Bank - fills available space */}
              <View style={styles.faderBankContainer}>
                <FaderBank />
              </View>
              
              {/* Preset Selector */}
              <PresetSelector />
            </View>

            {/* Right side: Knobs only */}
            <View style={styles.rightPanel}>
              <View style={styles.brushedBackgroundContainer}>
                <ImageBackground
                  source={require('../../assets/images/metallic-textured-background.jpg')}
                  style={styles.brushedBackground}
                  resizeMode="repeat"
                  imageStyle={styles.brushedImageStyle}
                />
              </View>
              <LinearGradient
                colors={['rgba(255,255,255,0.5)', 'rgba(0,0,0,0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.brushedOverlay}
              >
                <View style={styles.rightPanelContent}>
                  <KnobStack />
                </View>
              </LinearGradient>
            </View>
          </View>
        );

      case 'input':
        return (
          <ScrollView style={styles.tabContent}>
            <PEQControls
              peq={state.input.peq}
              onChange={(peq) => dispatch({ type: actions.SET_INPUT_PEQ, peq })}
              label="Input Parametric EQ"
            />
            <View style={styles.separator} />
            <FaderBank />
          </ScrollView>
        );

      case 'outputs':
        return (
          <ScrollView style={styles.tabContent}>
            {/* Channel Selector */}
            <View style={styles.channelSelector}>
              {['ch1', 'ch2', 'ch3', 'ch4'].map((ch, index) => (
                <TouchableOpacity
                  key={ch}
                  style={[
                    styles.channelTab,
                    selectedChannel === ch && styles.channelTabActive,
                  ]}
                  onPress={() => setSelectedChannel(ch)}
                >
                  <Text style={[
                    styles.channelTabText,
                    selectedChannel === ch && styles.channelTabTextActive,
                  ]}>
                    CH{index + 1}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Selected Channel Controls */}
            <RoutingMatrix />
            <View style={styles.separator} />
            
            <CrossoverControls
              xover={state.outputs[selectedChannel].xover}
              onChange={(xover) =>
                dispatch({
                  type: actions.SET_CHANNEL_XOVER,
                  channel: selectedChannel,
                  filter: 'hpf',
                  values: xover.hpf,
                })
              }
            />
            <View style={styles.separator} />
            
            <PEQControls
              peq={state.outputs[selectedChannel].peq}
              onChange={(peq) =>
                dispatch({
                  type: actions.SET_CHANNEL_PEQ,
                  channel: selectedChannel,
                  peq,
                })
              }
              label={`CH${selectedChannel.replace('ch', '')} Parametric EQ`}
            />
            <View style={styles.separator} />
            
            <DelayControl
              value={state.outputs[selectedChannel].delayMs}
              onChange={(value) =>
                dispatch({
                  type: actions.SET_CHANNEL_DELAY,
                  channel: selectedChannel,
                  value,
                })
              }
              label={`CH${selectedChannel.replace('ch', '')} Delay`}
            />
            <View style={styles.separator} />
            
            <View style={styles.centeredControl}>
              <PolaritySwitch
                value={state.outputs[selectedChannel].invert}
                onChange={(invert) =>
                  dispatch({
                    type: actions.SET_CHANNEL_POLARITY,
                    channel: selectedChannel,
                    invert,
                  })
                }
                label={`CH${selectedChannel.replace('ch', '')} Polarity`}
              />
            </View>
            <View style={styles.separator} />
            
            <LimiterControls
              limiter={state.outputs[selectedChannel].limiter}
              onChange={(values) =>
                dispatch({
                  type: actions.SET_CHANNEL_LIMITER,
                  channel: selectedChannel,
                  values,
                })
              }
              label={`CH${selectedChannel.replace('ch', '')} Limiter`}
            />
          </ScrollView>
        );

      case 'outputChannels':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.channelStripsContainer}>
              <Text style={styles.channelStripsLabel}>OUTPUT CHANNELS</Text>
              <View style={styles.channelStrips}>
                {['ch1', 'ch2', 'ch3', 'ch4'].map((ch) => (
                  <OutputChannelStrip key={ch} channel={ch} />
                ))}
              </View>
            </View>
          </ScrollView>
        );

      case 'tools':
        return (
          <ScrollView style={styles.tabContent}>
            <SequencerTools />
            <View style={styles.separator} />
            <Generators />
          </ScrollView>
        );

      case 'presets':
        return (
          <ScrollView style={styles.tabContent}>
            <PresetGrid />
            <View style={styles.separator} />
            <View style={styles.userPresets}>
              <Text style={styles.userPresetsTitle}>User Presets</Text>
              <View style={styles.userPresetsButtons}>
                <Button
                  title="Save Current"
                  onPress={() => {
                    const preset = {
                      name: `Preset ${state.global.userPresets.length + 1}`,
                      timestamp: Date.now(),
                      state: { ...state },
                    };
                    dispatch({ type: actions.SAVE_USER_PRESET, preset });
                    Alert.alert('Success', 'Preset saved to memory');
                  }}
                />
                <Button
                  title="Copy"
                  onPress={() => Alert.alert('Info', 'Copy feature - in-memory only')}
                />
              </View>
              {state.global.userPresets.length > 0 && (
                <View style={styles.userPresetsList}>
                  <Text style={styles.userPresetsSubtitle}>
                    {state.global.userPresets.length} saved preset(s)
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        );

      case 'settings':
        return (
          <ScrollView style={styles.tabContent}>
            <View style={styles.settingsContainer}>
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Firmware Version</Text>
                <Text style={styles.settingValue}>{state.global.firmwareVersion}</Text>
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Password Lock</Text>
                <RockerSwitch
                  value={state.global.passwordLocked}
                  onChange={(locked) =>
                    dispatch({ type: actions.SET_PASSWORD_LOCKED, locked })
                  }
                  leftLabel="OFF"
                  rightLabel="ON"
                />
              </View>

              <View style={styles.settingRow}>
                <Button
                  title="Update Firmware (OAD)"
                  onPress={() =>
                    Alert.alert('OAD Update', 'Mock firmware update button')
                  }
                />
              </View>

              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Device Info</Text>
                <Text style={styles.settingValue}>
                  Grundig1 Console{'\n'}
                  Build: 2025.11.12{'\n'}
                  React Native DSP UI
                </Text>
              </View>
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <PanelFrame>
        <View style={styles.screen}>
          {/* Tab Navigation */}
          <View style={styles.tabs}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, activeTab === tab.id && styles.tabActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab.id && styles.tabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab Content */}
          <View style={styles.contentArea}>{renderTabContent()}</View>
        </View>
      </PanelFrame>
    </SafeAreaView>
  );
}

export default function Grundig1() {
  return (
    <Grundig1Provider>
      <Grundig1Screen />
    </Grundig1Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.panel,
  },
  screen: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.panelAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.panelLight,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  tabText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.tight,
  },
  tabTextActive: {
    color: colors.accent,
  },
  contentArea: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
  homeLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    flexDirection: 'column',
  },
  faderBankContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  selectorsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  leftSelectors: {
    flex: 1,
  },
  rightSelectors: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  rightPanel: {
    width: 210,
    borderLeftWidth: 1,
    borderLeftColor: '#8f8f8f',
    borderRadius: 0,
    overflow: 'hidden',
  },
  brushedBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  brushedBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  brushedImageStyle: {
    opacity: 1,
    resizeMode: 'repeat',
  },
  brushedOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  rightPanelContent: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: spacing.md,
    paddingBottom: 0,
  },
  rightScroll: {
    flex: 1,
  },
  rightScrollContent: {
    paddingBottom: spacing.lg,
  },
  channelStripsContainer: {
    padding: spacing.md,
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  channelStripsLabel: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  channelStrips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  channelSelector: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  channelTab: {
    flex: 1,
    padding: spacing.sm,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  channelTabActive: {
    backgroundColor: colors.aluminum,
  },
  channelTabText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  channelTabTextActive: {
    color: colors.panel,
  },
  homeChannelSelector: {
    padding: spacing.md,
  },
  homeLimiters: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  homeSequencer: {
    padding: spacing.md,
  },
  homeSectionLabel: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  selectorButtonGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sequencerStack: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  selectorButton: {
    flex: 1,
    padding: spacing.sm,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  selectorButtonActive: {
    backgroundColor: colors.aluminum,
    borderColor: colors.accent,
  },
  sequencerButton: {
    flex: 0,
    width: '100%',
  },
  selectorButtonText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  selectorButtonTextActive: {
    color: colors.panel,
  },
  centeredControl: {
    alignItems: 'center',
    padding: spacing.md,
  },
  userPresets: {
    padding: spacing.md,
  },
  userPresetsTitle: {
    fontSize: typography.medium,
    color: colors.ink,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  userPresetsSubtitle: {
    fontSize: typography.small,
    color: colors.inkMuted,
    marginTop: spacing.md,
  },
  userPresetsButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  userPresetsList: {
    marginTop: spacing.md,
  },
  settingsContainer: {
    padding: spacing.md,
  },
  settingRow: {
    marginBottom: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingLabel: {
    fontSize: typography.small,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.sm,
  },
  settingValue: {
    fontSize: typography.regular,
    color: colors.ink,
  },
});

