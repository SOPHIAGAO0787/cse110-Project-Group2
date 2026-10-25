// Shared data shapes. Draft: to be finalized in the S1 contracts PR.

// A position in tile units (not pixels). Views convert with TILE.
export type Vec = { x: number; y: number };

export interface MapConfig {
  id: string;
  name: string;
  cols: number;
  rows: number;
  // One string per row: '#' buildable, 'P' enemy path, '.' blocked
  tiles: string[];
  // Waypoints enemies walk through, spawn → base, in tile coordinates
  path: Vec[];
}
