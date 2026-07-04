// JS interface for the baked-in native AppleMusic module.
//
// The NATIVE method surface (ios/AppleMusicModule.swift) is frozen into the build.
// Everything in THIS file is plain JS and can be changed via OTA update at any time,
// as long as it only calls native methods that already exist over there.
import { requireOptionalNativeModule, type EventSubscription } from 'expo-modules-core';

// Returns null when the native module isn't linked (Expo Go, web, JS-only export).
const Native = requireOptionalNativeModule<AppleMusicNative>('AppleMusic');

export const isAvailable: boolean = Native != null;

export type AuthStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined' | 'unknown';
export type PlaybackState =
  | 'playing' | 'paused' | 'stopped' | 'interrupted' | 'seekingForward' | 'seekingBackward' | 'unknown';
export type ShuffleMode = 'off' | 'songs' | 'albums' | 'default';
export type RepeatMode = 'none' | 'one' | 'all' | 'default';

export interface NowPlaying {
  persistentID: string;
  title: string;
  artist: string;
  albumTitle: string;
  albumArtist: string;
  genre: string;
  duration: number;      // seconds
  isExplicit: boolean;
  hasArtwork: boolean;
}

export interface PlaybackInfo {
  state: PlaybackState;
  currentTime: number;   // seconds
  shuffleMode: ShuffleMode;
  repeatMode: RepeatMode;
  indexOfNowPlayingItem: number;
}

export interface Playlist { id: string; name: string; count: number; }
export interface Song {
  persistentID: string; title: string; artist: string; albumTitle: string; duration: number;
}

interface AppleMusicNative {
  requestAuthorization(): Promise<AuthStatus>;
  getAuthorizationStatus(): AuthStatus;
  play(): void;
  pause(): void;
  stop(): void;
  togglePlayPause(): void;
  next(): void;
  previous(): void;
  skipToBeginning(): void;
  seek(seconds: number): void;
  setShuffleMode(mode: ShuffleMode): void;
  setRepeatMode(mode: RepeatMode): void;
  getNowPlaying(): NowPlaying | null;
  getPlaybackState(): PlaybackInfo;
  getArtwork(size: number): Promise<string | null>;   // data: URI or null
  getPlaylists(): Promise<Playlist[]>;
  getSongs(playlistId: string): Promise<Song[]>;
  playPlaylist(playlistId: string): void;
  playStoreIDs(ids: string[]): void;
  appendStoreIDs(ids: string[]): void;
  prependStoreIDs(ids: string[]): void;
  addListener(event: string, listener: (payload: any) => void): EventSubscription;
}

function requireNative(): AppleMusicNative {
  if (!Native) {
    throw new Error(
      'AppleMusic native module unavailable. It only works in a native build (not Expo Go/web).'
    );
  }
  return Native;
}

export const AppleMusic = {
  isAvailable,

  requestAuthorization: (): Promise<AuthStatus> => requireNative().requestAuthorization(),
  getAuthorizationStatus: (): AuthStatus => (Native ? Native.getAuthorizationStatus() : 'notDetermined'),

  play: () => requireNative().play(),
  pause: () => requireNative().pause(),
  stop: () => requireNative().stop(),
  togglePlayPause: () => requireNative().togglePlayPause(),
  next: () => requireNative().next(),
  previous: () => requireNative().previous(),
  skipToBeginning: () => requireNative().skipToBeginning(),
  seek: (seconds: number) => requireNative().seek(seconds),
  setShuffleMode: (mode: ShuffleMode) => requireNative().setShuffleMode(mode),
  setRepeatMode: (mode: RepeatMode) => requireNative().setRepeatMode(mode),

  getNowPlaying: (): NowPlaying | null => (Native ? Native.getNowPlaying() : null),
  getPlaybackState: (): PlaybackInfo | null => (Native ? Native.getPlaybackState() : null),
  getArtwork: (size = 512): Promise<string | null> => requireNative().getArtwork(size),

  getPlaylists: (): Promise<Playlist[]> => requireNative().getPlaylists(),
  getSongs: (playlistId: string): Promise<Song[]> => requireNative().getSongs(playlistId),
  playPlaylist: (playlistId: string) => requireNative().playPlaylist(playlistId),
  playStoreIDs: (ids: string[]) => requireNative().playStoreIDs(ids),
  appendStoreIDs: (ids: string[]) => requireNative().appendStoreIDs(ids),
  prependStoreIDs: (ids: string[]) => requireNative().prependStoreIDs(ids),

  addNowPlayingListener: (cb: (info: NowPlaying) => void): EventSubscription =>
    requireNative().addListener('onNowPlayingChange', cb),
  addPlaybackStateListener: (cb: (info: PlaybackInfo) => void): EventSubscription =>
    requireNative().addListener('onPlaybackStateChange', cb),
};

export default AppleMusic;
