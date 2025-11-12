# Grundig1 Vintage EQ Console - Arduino Integration Guide

## Overview

The Grundig1 console is a fully-functional React Native DSP control interface that syncs bidirectionally with your Arduino ESP32 device. All UI controls automatically push changes to the Arduino via REST API, and the UI polls the device every 5 seconds to stay in sync.

## Architecture

```
┌─────────────────┐     HTTP REST API      ┌──────────────────┐
│  React Native   │ ←──────────────────→  │  Arduino ESP32   │
│  Grundig1 UI    │   (5s polling sync)    │   (Web Server)   │
└─────────────────┘                        └──────────────────┘
        ↓                                            ↓
  Local Storage                              NVS Storage
  (AsyncStorage)                             (Preferences)
```

## Arduino API Endpoints

Your Arduino exposes these endpoints (already implemented in `dspClient.js`):

### State & Status
- `GET /api/status` - Quick status check
- `GET /api/state` - Full device state (all parameters)

### Control Endpoints
- `POST /api/master` - Set master level (0-100%)
- `POST /api/input/geq` - Set 15-band graphic EQ
- `POST /api/input/peq` - Set input parametric EQ
- `POST /api/output` - Set output channel (CH1-4) settings
- `POST /api/gen` - Control signal generators
- `POST /api/seq` - Control sequencer (S1-S3)
- `POST /api/battery` - Update voltmeter reading
- `POST /api/lock` - Lock/unlock device
- `POST /api/preset/save` - Save preset to slot (0-15)
- `POST /api/preset/load` - Load preset from slot
- `POST /api/preset/copy` - Copy preset between slots

## Data Flow

### Arduino → React Native (Pull)
1. **On mount:** UI calls `syncFromArduino()` to fetch initial state
2. **Periodic sync:** Every 5 seconds, UI polls `/api/state` and merges changes
3. **State converter:** `arduinoToGrundig1State()` transforms Arduino JSON to UI format

### React Native → Arduino (Push)
1. **User interaction:** User adjusts a control (fader, knob, switch)
2. **Local state update:** Redux-style action updates local state immediately
3. **API queue:** Change is queued for Arduino sync (300ms debounce)
4. **HTTP POST:** Debounced API call sends update to Arduino
5. **Visual feedback:** Sync status shown in UI (`_syncStatus`)

## Field Name Mapping

### Arduino ↔ Grundig1 Conversions

| Arduino Field | Grundig1 Field | Notes |
|---------------|----------------|-------|
| `master` (0-1) | `global.master` (0-100) | Percentage conversion |
| `input.geq[]` | `input.graphicEq[]` | 15-band array |
| `input.peq.{f,g,q}` | `input.peq.{freq,gain,q}` | PEQ parameters |
| `outputs[].hpf.freq` | `outputs.ch1.xover.hpf.freqHz` | Crossover freq |
| `outputs[].limiter.thr` | `outputs.ch1.limiter.thresholdDb` | Limiter threshold |
| `battery.{v,min,max}` | `global.voltmeter.{live,min,max}` | Voltmeter readings |
| `seq.{s1,s2,s3}` | `sequencer.{s1,s2,s3}` | Sequencer enables |
| `gen.sineEn` | `generators.mode === 'sine'` | Generator type |

## Usage Example

### 1. Set Master Volume
```javascript
// User moves master slider in UI
dispatch({ type: actions.SET_MASTER, value: 75 });

// Automatic API call (debounced 300ms):
// POST /api/master
// Body: { "levelPct": 75 }
```

### 2. Adjust Graphic EQ
```javascript
// User moves fader for 1kHz band (index 5)
dispatch({ type: actions.SET_GRAPHIC_EQ_BAND, band: 5, value: 3.5 });

// Automatic API call:
// POST /api/input/geq
// Body: { "bands": [0, 0, 0, 0, 0, 3.5, 0, ...] }
```

### 3. Configure Output Channel
```javascript
// User changes CH1 crossover HPF frequency
dispatch({
  type: actions.SET_CHANNEL_XOVER,
  channel: 'ch1',
  filter: 'hpf',
  values: { freqHz: 120 }
});

// Automatic API call:
// POST /api/output
// Body: {
//   "ch": 1,
//   "hpf": { "type": "LR", "slope": 24, "freq": 120, "enabled": true },
//   ...
// }
```

## Connection Setup

### Step 1: Configure Arduino IP
On the Status screen, enter your ESP32's IP address:
```
http://192.168.1.42
```

### Step 2: Navigate to Grundig1
Tap **"Grundig1 Console →"** button

### Step 3: Verify Connection
Look for sync status indicator (planned enhancement - shows connected/disconnected state)

## Sync Behavior

### Conflict Resolution
- **UI changes** take priority and push to Arduino immediately
- **Arduino changes** (from other sources) sync every 5 seconds
- **User presets** are stored locally only (not on Arduino)

### Offline Mode
- UI works offline using local AsyncStorage cache
- Changes queue and retry when connection restored
- Sync status shows connection errors

### Auto-Save
- Local state auto-saves to AsyncStorage every 1 second
- Arduino auto-saves to NVS on every change
- Both survive app/device restart

## Preset Management

### Factory Presets (Hardcoded)
- **Graphic EQ:** 12 presets (Flat, Bass Boost, etc.)
- **Crossover:** 11 presets (Full Range, Sub, 2-way, etc.)
- Loaded from Arduino or local definitions

### User Presets (Local + Arduino)
```javascript
// Save to Arduino slot 0-15
await dsp.savePreset(0, 'My Custom Setup');

// Load from Arduino slot
await dsp.loadPreset(0);

// Copy between Arduino slots
await dsp.copyPreset(0, 1);
```

## Testing Without Arduino

The UI works standalone if Arduino is not available:
1. Initial state loads from AsyncStorage
2. Mock voltmeter fluctuates automatically
3. All controls function locally
4. Periodic sync attempts will fail silently
5. Changes persist in AsyncStorage

To test with mock data:
```javascript
// Manually trigger sync with mock data
dispatch({
  type: actions.RESTORE_STATE,
  state: mockGrundig1State
});
```

## Debugging

### Enable Console Logging
```javascript
// In grundig1Store.js, logs show:
[Grundig1] Synced from Arduino
[Grundig1] Arduino API error: Network request failed
```

### Check Sync Status
```javascript
const { state } = useGrundig1Store();
console.log(state._syncStatus);
// { connected: true, lastSync: 1699876543210, error: null }
```

### Monitor Network
Use React Native Debugger or Flipper to inspect:
- HTTP requests to Arduino
- Response times
- Error messages

## Performance Optimizations

1. **Debouncing:** 300ms debounce prevents API spam during fader drags
2. **Batching:** Multiple changes to same channel batched into single API call
3. **Selective sync:** Only changed fields sent to Arduino
4. **Polling interval:** 5-second sync balances freshness vs. traffic

## Error Handling

```javascript
// API errors update sync status
state._syncStatus = {
  connected: false,
  error: 'HTTP 500: Internal Server Error',
  lastSync: 1699876543210
};

// UI can show warning banner:
if (!state._syncStatus.connected) {
  <Text>⚠️ Arduino disconnected</Text>
}
```

## Advanced: Custom API Calls

```javascript
import { dsp } from '../api/dspClient';

// Direct API access
const setCustomValue = async () => {
  await dsp.setOutput(1, {
    gainDb: -3,
    mute: false,
    route: 'A+B'
  });
};
```

## Future Enhancements

- [ ] WebSocket support for real-time bidirectional sync
- [ ] Undo/redo with change history
- [ ] Multi-device sync (cloud backup)
- [ ] Firmware OTA updates via UI
- [ ] Waveform visualization from ADC
- [ ] Spectrum analyzer overlay

## Troubleshooting

**Problem:** UI doesn't update from Arduino changes  
**Solution:** Check 5-second polling is running, verify `/api/state` endpoint

**Problem:** Changes not saving to Arduino  
**Solution:** Check network connection, verify CORS headers, check Arduino logs

**Problem:** Preset loading fails  
**Solution:** Verify preset slot (0-15) has data, check Arduino NVS storage

**Problem:** Voltmeter not updating  
**Solution:** Arduino should POST to `/api/battery` with ADC readings

## API Reference

See `api/dspClient.js` for full API documentation with JSDoc comments.

## License

Same as parent project.

