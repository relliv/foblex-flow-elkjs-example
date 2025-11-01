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
      const output = this.extractLayoutResults(result);

      return output;
    } catch (error) {
      console.error('ELK layout error:', error);

      throw error;
    }
  }

  /**
   * Builds the ELK.js graph structure from input data
   * @private
   */
  private buildElkGraph(input: ILayoutInput, options: IElkLayoutOptions): any {
    const { groups, nodes, edges, enableGroups } = input;

    // For layered algorithm with groups, use INCLUDE_CHILDREN for proper cross-hierarchical edges
    if (enableGroups && options.algorithm === 'layered') {
      // Build groups with hierarchy handling
      const elkGroups = groups.map(group => {
        const groupChildren = nodes
          .filter(node => node.parentId === group.id)
          .map(node => ({
            id: node.id,
            width: node.size.width,
            height: node.size.height,
          }));

        return {
          id: group.id,
          // Set INCLUDE_CHILDREN on groups to include them in single layout run
          layoutOptions: {
            'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
            'elk.padding': '[top=60,left=60,bottom=60,right=60]',
          },
          children: groupChildren,
          edges: [], // Edges will be at root level
        };
      });

      // Root nodes
      const rootNodes = nodes
        .filter(node => !node.parentId)
        .map(node => ({
          id: node.id,
          width: node.size.width,
          height: node.size.height,
        }));

      // ALL edges at root level for cross-hierarchical support
      const allEdges = edges.map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      }));

      return {
        id: 'root',
        layoutOptions: {
          ...this.buildRootLayoutOptions(options),
          // Critical: Set INCLUDE_CHILDREN on root to layout entire hierarchy in one run
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        },
        children: [...elkGroups, ...rootNodes],
        edges: allEdges,
      };
    }

    // Original logic for other algorithms
    const elkGroups = enableGroups
      ? this.buildGroupHierarchy(groups, nodes, edges, options)
      : [];

    const rootNodes = nodes
      .filter(node => !node.parentId)
      .map(node => ({
        id: node.id,
        width: node.size.width,
        height: node.size.height,
        type: 'node',
      }));

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
  private extractLayoutResults(result: any): ILayoutOutput {
    const groups: IGroup[] = [];
    const nodes: INode[] = [];
    const edges: IEdge[] = [];

    // Helper function to recursively extract nodes from groups
    const extractNodesFromGroup = (
      group: any,
      parentOffset = { x: 0, y: 0 }
    ) => {
      const groupX = parentOffset.x + (group.x || 0);
      const groupY = parentOffset.y + (group.y || 0);

      if (group.children) {
        group.children.forEach((child: any) => {
          // Check if child is a node (not a nested group)
          if (!child.children || child.type === 'node') {
            const absoluteX = groupX + (child.x || 0);
            const absoluteY = groupY + (child.y || 0);

            nodes.push({
              id: child.id,
              size: {
                width: child.width,
                height: child.height,
              },
              position: PointExtensions.initialize(absoluteX, absoluteY),
              parentId: group.id,
            });
          }
        });
      }
    };

    // Process all children from result
    if (result?.children) {
      result.children.forEach((child: any) => {
        // Check if it's a group (has children or explicitly marked as group)
        if (child.children || child.type === 'group') {
          // It's a group
          groups.push({
            id: child.id,
            size: {
              width: child.width,
              height: child.height,
            },
            position: PointExtensions.initialize(child.x || 0, child.y || 0),
          });

          // Extract nodes from this group
          extractNodesFromGroup(child);
        } else {
          // It's a root-level node
          nodes.push({
            id: child.id,
            size: {
              width: child.width,
              height: child.height,
            },
            position: PointExtensions.initialize(child.x || 0, child.y || 0),
            parentId: null,
          });
        }
      });
    }

    // Extract all edges from root level (they should all be at root with INCLUDE_CHILDREN)
    (result?.edges || []).forEach((edge: any) => {
      edges.push({
        id: edge.id,
        source: edge.sources[0],
        target: edge.targets[0],
        sourceHandle: edge.sources[0],
        targetHandle: edge.targets[0],
      });
    });

    // Also check for edges in groups (in case some are nested despite INCLUDE_CHILDREN)
    if (result?.children) {
      result.children.forEach((child: any) => {
        if ((child.children || child.type === 'group') && child.edges) {
          child.edges.forEach((edge: any) => {
            // Check if this edge isn't already added
            if (!edges.find(e => e.id === edge.id)) {
              edges.push({
                id: edge.id,
                source: edge.sources[0],
                target: edge.targets[0],
                sourceHandle: edge.sources[0],
                targetHandle: edge.targets[0],
              });
            }
          });
        }
      });
    }

    return { groups, nodes, edges };
  }
}
