export enum TreeMode {
  CHAOS = 'CHAOS',
  FORMED = 'FORMED'
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}

export interface ParticleData {
  chaosPos: [number, number, number];
  formedPos: [number, number, number];
  speed: number;
  color: string;
}

export type MusicSourceType = 'youtube' | 'spotify' | 'zing' | 'audio' | 'soundcloud' | null;

export interface ActiveTrack {
  type: MusicSourceType;
  url: string;
  embedId: string;
  title: string;
  artist?: string;
  extraType?: 'track' | 'playlist' | 'album';
  playlistId?: string;
  startTime?: number;
}

export type MaskType = 'none' | 'santa' | 'cat' | 'reindeer' | 'snowman' | 'masquerade' | 'cool' | 'blur';

