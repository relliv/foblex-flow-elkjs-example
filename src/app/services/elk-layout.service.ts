import { Injectable } from '@angular/core';
import { PointExtensions } from '@foblex/2d';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  IEdge,
  IElkLayoutOptions,
  IGroup,
  ILayoutInput,
  ILayoutOutput,
  INode,
} from '../models/graph.interface';

/**
 * Service responsible for graph layout using ELK.js
 * Follows Single Responsibility Principle - handles only layout calculations
 */
@Injectable({
  providedIn: 'root',
})
export class ElkLayoutService {
  private elk = new ELK();
  private defaultOptions: IElkLayoutOptions = {
    algorithm: 'layered',
    direction: 'RIGHT',
    spacing: {
      nodeNode: 80,
      nodeNodeBetweenLayers: 80,
      componentComponent: 100,
      edgeNode: 40,
      edgeEdge: 20,
    },
    groupPadding: {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50,
    },
    edgeRouting: 'ORTHOGONAL',
    nodePlacement: 'NETWORK_SIMPLEX',
  };

  /**
   * Performs layout calculation on the provided graph data
   * @param input - Graph data with nodes, edges, and groups
   * @param options - Optional layout configuration (merged with defaults)
   * @returns Promise with calculated positions
   */
  public async calculateLayout(
    input: ILayoutInput,
    options?: Partial<IElkLayoutOptions>
  ): Promise<ILayoutOutput> {
    const layoutOptions = { ...this.defaultOptions, ...options };
    const graph = this.buildElkGraph(input, layoutOptions);

    try {
      const result = await this.elk.layout(graph);
      return this.extractLayoutResults(result, input.enableGroups);
    } catch (error) {
      console.error('ELK layout error:', error);
      throw error;
    }
  }

  /**
   * Builds the ELK.js graph structure from input data
   * @private
   */
  private buildElkGraph(
    input: ILayoutInput,
    options: IElkLayoutOptions
  ): any {
    const { groups, nodes, edges, enableGroups } = input;

    // Build hierarchical group structure (if enabled)
    const elkGroups = enableGroups
      ? this.buildGroupHierarchy(groups, nodes, edges, options)
      : [];

    // Build root-level nodes
    const rootNodes = nodes
      .filter(node => !node.parentId)
      .map(node => ({
        id: node.id,
        width: node.size.width,
        height: node.size.height,
        type: 'node',
      }));

    // Build root-level edges
    const rootEdges = enableGroups
      ? this.buildRootLevelEdges(nodes, edges)
      : edges.map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        }));

    return {
      id: 'root',
      layoutOptions: this.buildRootLayoutOptions(options),
      children: [...elkGroups, ...rootNodes],
      edges: rootEdges,
    };
  }

  /**
   * Builds the group hierarchy with nested children
   * @private
   */
  private buildGroupHierarchy(
    groups: IGroup[],
    nodes: INode[],
    edges: IEdge[],
    options: IElkLayoutOptions
  ): any[] {
    return groups.map(group => {
      const children = nodes
        .filter(node => node.parentId === group.id)
        .map(node => ({
          id: node.id,
          width: node.size.width,
          height: node.size.height,
          type: 'node',
        }));

      const groupEdges = edges
        .filter(edge => {
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          return (
            sourceNode?.parentId === group.id &&
            targetNode?.parentId === group.id
          );
        })
        .map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        }));

      return {
        id: group.id,
        type: 'group',
        layoutOptions: this.buildGroupLayoutOptions(options),
        children,
        edges: groupEdges,
      };
    });
  }

  /**
   * Builds edges that connect nodes at different levels or groups
   * @private
   */
  private buildRootLevelEdges(nodes: INode[], edges: IEdge[]): any[] {
    return edges
      .filter(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        // Include edge if nodes are in different groups or at root level
        return (
          sourceNode?.parentId !== targetNode?.parentId ||
          (!sourceNode?.parentId && !targetNode?.parentId)
        );
      })
      .map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      }));
  }

  /**
   * Builds root-level layout options
   * @private
   */
  private buildRootLayoutOptions(options: IElkLayoutOptions): any {
    const baseOptions: any = {
      'elk.algorithm': options.algorithm,
      'elk.spacing.nodeNode': `${options.spacing?.nodeNode}`,
      'elk.spacing.componentComponent': `${options.spacing?.componentComponent}`,
      'elk.separateConnectedComponents': 'true',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    };

    // Add algorithm-specific options
    if (options.algorithm === 'layered') {
      return {
        ...baseOptions,
        'elk.direction': options.direction,
        'elk.layered.spacing.nodeNodeBetweenLayers': `${options.spacing?.nodeNodeBetweenLayers}`,
        'elk.spacing.edgeNode': `${options.spacing?.edgeNode}`,
        'elk.spacing.edgeEdge': `${options.spacing?.edgeEdge}`,
        'elk.layered.nodePlacement.strategy': options.nodePlacement,
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.cycleBreaking.strategy': 'GREEDY',
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.thoroughness': '10',
        'elk.edgeRouting': options.edgeRouting,
        'elk.layered.edgeRouting.selfLoopPlacement': 'NORTH_STACKED',
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.considerModelOrder.strategy': 'NODES_AND_EDGES',
        'elk.interactiveLayout': 'true',
      };
    } else if (options.algorithm === 'mrtree') {
      // Tree-specific options
      return {
        ...baseOptions,
        'elk.direction': options.direction,
        'elk.spacing.nodeNode': '60',
        'elk.spacing.edgeNode': '30',
        'elk.mrtree.searchOrder': 'DFS',
        'elk.mrtree.orderingStrategy': 'PREORDER',
        'elk.edgeRouting': 'ORTHOGONAL',
      };
    } else if (options.algorithm === 'force') {
      // Force-directed options
      return {
        ...baseOptions,
        'elk.force.model': 'FRUCHTERMAN_REINGOLD',
        'elk.force.iterations': '500',
        'elk.force.repulsivePower': '0',
        'elk.force.temperature': '0.001',
        'elk.force.repulsion': '2.0',
        'elk.spacing.nodeNode': '150',
        'elk.interactive': 'true',
        'elk.randomizationSeed': '1',
      };
    } else if (options.algorithm === 'stress') {
      // Stress minimization options
      return {
        ...baseOptions,
        'elk.stress.desiredEdgeLength': '100',
        'elk.stress.iterationLimit': '300',
      };
    }

    return baseOptions;
  }

  /**
   * Builds group-level layout options
   * @private
   */
  private buildGroupLayoutOptions(options: IElkLayoutOptions): any {
    const padding = options.groupPadding;
    const baseGroupOptions: any = {
      'elk.algorithm': options.algorithm,
      'elk.padding': `[top=${padding?.top},left=${padding?.left},bottom=${padding?.bottom},right=${padding?.right}]`,
      'elk.spacing.nodeNode': '50',
      'elk.spacing.componentComponent': '70',
      'elk.nodeSize.constraints': 'NODE_LABELS MINIMUM_SIZE',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    };

    // Add algorithm-specific options for groups
    if (options.algorithm === 'layered') {
      return {
        ...baseGroupOptions,
        'elk.direction': options.direction,
        'elk.layered.spacing.nodeNodeBetweenLayers': '50',
        'elk.layered.nodePlacement.strategy': options.nodePlacement,
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.cycleBreaking.strategy': 'GREEDY',
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.edgeRouting': options.edgeRouting,
        'elk.layered.edgeRouting.selfLoopPlacement': 'NORTH_STACKED',
        'elk.portConstraints': 'FIXED_SIDE',
        'elk.considerModelOrder.strategy': 'NODES_AND_EDGES',
      };
    } else if (options.algorithm === 'mrtree') {
      return {
        ...baseGroupOptions,
        'elk.direction': options.direction,
        'elk.spacing.nodeNode': '40',
        'elk.mrtree.searchOrder': 'DFS',
        'elk.mrtree.orderingStrategy': 'PREORDER',
        'elk.edgeRouting': 'ORTHOGONAL',
      };
    } else if (options.algorithm === 'force') {
      return {
        ...baseGroupOptions,
        'elk.force.model': 'FRUCHTERMAN_REINGOLD',
        'elk.force.iterations': '300',
        'elk.force.repulsion': '1.5',
        'elk.spacing.nodeNode': '80',
      };
    } else if (options.algorithm === 'stress') {
      return {
        ...baseGroupOptions,
        'elk.stress.desiredEdgeLength': '60',
        'elk.stress.iterationLimit': '200',
      };
    }

    return baseGroupOptions;
  }

  /**
   * Extracts layout results from ELK output
   * Converts ELK's nested structure to flat arrays with absolute positions
   * @private
   */
  private extractLayoutResults(
    result: any,
    enableGroups: boolean
  ): ILayoutOutput {
    const groups: IGroup[] = [];
    const nodes: INode[] = [];
    const edges: IEdge[] = [];

    // Extract groups
    if (enableGroups) {
      const elkGroups =
        result?.children?.filter((node: any) => node.type === 'group') || [];

      elkGroups.forEach((group: any) => {
        groups.push({
          id: group.id,
          size: {
            width: group.width,
            height: group.height,
          },
          position: PointExtensions.initialize(group.x || 0, group.y || 0),
        });

        // Extract nodes from within groups (convert to absolute positions)
        if (group.children) {
          group.children.forEach((node: any) => {
            const absoluteX = (group.x || 0) + (node.x || 0);
            const absoluteY = (group.y || 0) + (node.y || 0);

            nodes.push({
              id: node.id,
              size: {
                width: node.width,
                height: node.height,
              },
              position: PointExtensions.initialize(absoluteX, absoluteY),
              parentId: group.id,
            });
          });
        }
      });
    }

    // Extract root-level nodes
    const rootNodes =
      result?.children?.filter((node: any) => node.type === 'node') || [];
    rootNodes.forEach((node: any) => {
      nodes.push({
        id: node.id,
        size: {
          width: node.width,
          height: node.height,
        },
        position: PointExtensions.initialize(node.x || 0, node.y || 0),
        parentId: null,
      });
    });

    // Extract edges
    (result?.edges || []).forEach((edge: any) => {
      edges.push({
        id: edge.id,
        source: edge.sources[0],
        target: edge.targets[0],
        sourceHandle: edge.sources[0],
        targetHandle: edge.targets[0],
      });
    });

    return { groups, nodes, edges };
  }
}
