export type LayerType = "rect" | "ellipse" | "text" | "path";

export type AlignmentMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface LayerStyle {
  opacity: number;
  fill: string;
  stroke?: string;
  strokeWidth: number;
}

export interface MaskRelationship {
  maskedBy?: string;
  maskFor?: string[];
}

interface BaseLayer extends Geometry, LayerStyle, MaskRelationship {
  id: string;
  type: LayerType;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface RectLayer extends BaseLayer {
  type: "rect";
  cornerRadius: number;
}

export interface EllipseLayer extends BaseLayer {
  type: "ellipse";
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
}

export interface PathLayer extends BaseLayer {
  type: "path";
  path: string;
}

export type LogoLayer = RectLayer | EllipseLayer | TextLayer | PathLayer;

type LayerInputDefaults = Partial<Geometry> &
  Partial<LayerStyle> &
  Pick<BaseLayer, "type" | "name"> & {
    cornerRadius?: number;
    text?: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    path?: string;
  };

export type NewLayerInput = LayerInputDefaults & Pick<Geometry, "x" | "y" | "width" | "height">;

export interface DocumentSettings {
  width: number;
  height: number;
  gridSize: number;
  snapToGrid: boolean;
  background: string;
}

export interface LogoDocument {
  id: string;
  name: string;
  version: number;
  settings: DocumentSettings;
  layers: LogoLayer[];
  selectedLayerIds: string[];
}

export interface ExportOptions {
  format: "svg" | "png" | "pdf";
  scale: number;
  includeHiddenLayers: boolean;
  transparentBackground: boolean;
}

export interface HistoryState {
  past: LogoDocument[];
  present: LogoDocument;
  future: LogoDocument[];
}
