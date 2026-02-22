declare module '@mapbox/mapbox-gl-geocoder' {
  import { Map, ControlPosition } from 'mapbox-gl';

  export interface GeocoderOptions {
    accessToken: string;
    mapboxgl: any;
    placeholder?: string;
    marker?: boolean;
    [key: string]: any;
  }

  export default class MapboxGeocoder {
    constructor(options: GeocoderOptions);
    onAdd(map: Map): HTMLElement;
    onRemove(): void;
    getDefaultPosition(): ControlPosition;
  }
}
