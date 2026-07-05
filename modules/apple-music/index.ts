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

// Library song (your added/downloaded songs) — MediaPlayer.
export interface LibrarySong {
  persistentID: string;
  playbackStoreID: string; // Apple Music catalog id if it's a store item, else ''
  title: string; artist: string; albumTitle: string; duration: number; hasArtwork: boolean;
}
// Apple Music catalog items — MusicKit.
export interface CatalogSong {
  id: string; title: string; artist: string; albumTitle: string; duration: number; artworkURL: string;
}
export interface CatalogPlaylist { id: string; name: string; curator: string; artworkURL: string; }
export interface CatalogAlbum { id: string; title: string; artist: string; artworkURL: string; }
export interface CatalogArtist { id: string; name: string; }
export interface CatalogSearchResults {
  songs: CatalogSong[]; albums: CatalogAlbum[]; playlists: CatalogPlaylist[]; artists: CatalogArtist[];
}
export interface Charts { songs: CatalogSong[]; playlists: CatalogPlaylist[]; }
export interface Recommendation { title: string; playlists: CatalogPlaylist[]; albums: CatalogAlbum[]; }

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
  // --- Added natively, staged for the next rebuild (NOT in the current build) ---
  searchLibrarySongs(term: string, limit: number): Promise<LibrarySong[]>;
  getAllSongs(limit: number): Promise<LibrarySong[]>;
  playLibrarySongs(persistentIDs: string[]): void;
  requestMusicKitAuthorization(): Promise<string>;
  searchCatalogSongs(term: string, limit: number): Promise<CatalogSong[]>;
  getNowPlayingCatalogArtworkURL(size: number): Promise<string | null>;
  searchCatalog(term: string, limit: number): Promise<CatalogSearchResults>;
  getCatalogCharts(limit: number): Promise<Charts>;
  getRecommendations(limit: number): Promise<Recommendation[]>;
  getCatalogPlaylistTracks(playlistId: string): Promise<CatalogSong[]>;
  getRecentlyAddedSongs(limit: number): Promise<LibrarySong[]>;
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

  // --- Staged for the next rebuild. These native methods DO NOT exist in the
  // current build. Feature-detect with `AppleMusic.capabilities` before calling,
  // or they'll throw on the current build. Do not wire into UI until rebuilt. ---
  searchLibrarySongs: (term: string, limit = 50): Promise<LibrarySong[]> =>
    requireNative().searchLibrarySongs(term, limit),
  getAllSongs: (limit = 200): Promise<LibrarySong[]> => requireNative().getAllSongs(limit),
  playLibrarySongs: (persistentIDs: string[]) => requireNative().playLibrarySongs(persistentIDs),
  requestMusicKitAuthorization: (): Promise<string> => requireNative().requestMusicKitAuthorization(),
  searchCatalogSongs: (term: string, limit = 25): Promise<CatalogSong[]> =>
    requireNative().searchCatalogSongs(term, limit),
  getNowPlayingCatalogArtworkURL: (size = 600): Promise<string | null> =>
    requireNative().getNowPlayingCatalogArtworkURL(size),
  searchCatalog: (term: string, limit = 25): Promise<CatalogSearchResults> =>
    requireNative().searchCatalog(term, limit),
  getCatalogCharts: (limit = 20): Promise<Charts> => requireNative().getCatalogCharts(limit),
  getRecommendations: (limit = 12): Promise<Recommendation[]> => requireNative().getRecommendations(limit),
  getCatalogPlaylistTracks: (playlistId: string): Promise<CatalogSong[]> =>
    requireNative().getCatalogPlaylistTracks(playlistId),
  getRecentlyAddedSongs: (limit = 100): Promise<LibrarySong[]> =>
    requireNative().getRecentlyAddedSongs(limit),
};

// Which staged methods actually exist on the linked native module. Use this to
// guard UI so it never calls a method that isn't in the running build yet.
export const capabilities = {
  librarySearch: typeof (Native as any)?.searchLibrarySongs === 'function',
  libraryPlay: typeof (Native as any)?.playLibrarySongs === 'function',
  recentlyAdded: typeof (Native as any)?.getRecentlyAddedSongs === 'function',
  catalogSearch: typeof (Native as any)?.searchCatalog === 'function',
  charts: typeof (Native as any)?.getCatalogCharts === 'function',
  recommendations: typeof (Native as any)?.getRecommendations === 'function',
  catalogPlaylistTracks: typeof (Native as any)?.getCatalogPlaylistTracks === 'function',
};

export default AppleMusic;
