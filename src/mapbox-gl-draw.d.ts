declare module '@mapbox/mapbox-gl-draw' {
  import { IControl, ControlPosition } from 'mapbox-gl';
  
  interface DrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    defaultMode?: string;
    modes?: any;
    styles?: any[];
    userProperties?: boolean;
    boxSelect?: boolean;
    clickOnVertex?: boolean;
    touchEnabled?: boolean;
    touchBuffer?: number;
    keybindings?: boolean;
  }

  class MapboxDraw implements IControl {
    constructor(options?: DrawOptions);
    
    onAdd(map: mapboxgl.Map): HTMLElement;
    onRemove(map: mapboxgl.Map): void;
    getDefaultPosition(): ControlPosition;
    
    add(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection): string[];
    get(id: string): GeoJSON.Feature | undefined;
    getFeatureIdsAt(point: { x: number; y: number }): string[];
    getSelected(): GeoJSON.FeatureCollection;
    getSelectedIds(): string[];
    getAll(): GeoJSON.FeatureCollection;
    delete(ids: string | string[]): this;
    deleteAll(): this;
    set(featureCollection: GeoJSON.FeatureCollection): string[];
    trash(): this;
    combineFeatures(): this;
    uncombineFeatures(): this;
    getMode(): string;
    changeMode(mode: string, options?: any): this;
    setFeatureProperty(id: string, property: string, value: any): this;
  }

  export default MapboxDraw;
}
