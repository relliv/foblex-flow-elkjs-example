import { IPoint, ISize } from '@foblex/2d';

/**
 * Represents a group container in the flow diagram
 */
export interface IGroup {
  id: string;
  size: ISize;
  position?: IPoint;
}

/**
 * Represents a node in the flow diagram
 */
export interface INode {
  id: string;
  size: ISize;
  position?: IPoint;
  parentId: string | null; // null = root level, otherwise group ID
}

/**
 * Represents an edge connection between nodes
 */
export interface IEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

/**
 * Input data for the layout engine
 */
export interface ILayoutInput {
  groups: IGroup[];
  nodes: INode[];
  edges: IEdge[];
  enableGroups: boolean;
}

/**
 * Output data from the layout engine
 */
export interface ILayoutOutput {
  groups: IGroup[];
  nodes: INode[];
  edges: IEdge[];
}

/**
 * Configuration options for ELK layout
 */
export interface IElkLayoutOptions {
  algorithm?: 'layered' | 'force' | 'stress' | 'mrtree';
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  spacing?: {
    nodeNode?: number;
    nodeNodeBetweenLayers?: number;
    componentComponent?: number;
    edgeNode?: number;
    edgeEdge?: number;
  };
  groupPadding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  edgeRouting?: 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
  nodePlacement?: 'NETWORK_SIMPLEX' | 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS';
}
