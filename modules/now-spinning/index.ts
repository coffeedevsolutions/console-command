// JS interface for the baked-in native NowSpinning (ShazamKit) module.
//
// The NATIVE surface (ios/NowSpinningModule.swift) is frozen into the build. Everything in
// THIS file is plain JS and can change via OTA at any time, as long as it only calls native
// methods that already exist over there. Until the next `eas build`, `capabilities.shazam` is
// false and callers must feature-detect (nothing calls this yet). See NOW_SPINNING_PLAN.md.
import { requireOptionalNativeModule } from 'expo-modules-core';

// Null when the native module isn't linked (current build, Expo Go, web, JS-only export).
const Native = requireOptionalNativeModule<NowSpinningNative>('NowSpinning');

export type MicPermission = 'granted' | 'denied' | 'undetermined';

// A ShazamKit match. `matchOffset` = seconds into the track (predictedCurrentMatchOffset);
// `appleMusicID` feeds a MusicKit lookup for the track duration that drives the Mode-A cadence.
export interface ShazamMatch {
  title?: string;
  artist?: string;
  artworkURL?: string;
  appleMusicID?: string;
  isrc?: string;
  subtitle?: string;
  matchOffset: number;
  listenLatency: number;
}

interface NowSpinningNative {
  recognizeOnce(timeoutSec: number): Promise<ShazamMatch | null>;
  requestMicPermission(): Promise<'granted' | 'denied'>;
  micPermissionStatus(): MicPermission;
}

export const isAvailable: boolean = Native != null;

function requireNative(): NowSpinningNative {
  if (!Native) {
    throw new Error(
      'NowSpinning native module unavailable. It only works in a native build with ShazamKit (next eas build).'
    );
  }
  return Native;
}

export const NowSpinning = {
  isAvailable,
  // One short listen; resolves the first Shazam match or null on no-match/timeout.
  recognizeOnce: (timeoutSec = 6): Promise<ShazamMatch | null> =>
    requireNative().recognizeOnce(timeoutSec),
  requestMicPermission: (): Promise<'granted' | 'denied'> =>
    requireNative().requestMicPermission(),
  micPermissionStatus: (): MicPermission =>
    (Native ? Native.micPermissionStatus() : 'undetermined'),
};

// Whether the ShazamKit primitive exists in the running build. Guard all UI with this so the
// current (pre-rebuild) build never calls a method that isn't linked yet.
export const capabilities = {
  shazam: typeof (Native as unknown as NowSpinningNative | null)?.recognizeOnce === 'function',
};

export default NowSpinning;
