import {
  Component,
  OnInit,
  QueryList,
  signal,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {
  EFResizeHandleType,
  FCanvasComponent,
  FFlowModule,
  FGroupDirective,
  FNodeBase,
  FNodeDirective,
} from '@foblex/flow';
import { IPoint, ISize, PointExtensions } from '@foblex/2d';
import { v4 as uuidv4 } from 'uuid';
import ELK from 'elkjs/lib/elk.bundled.js';
import { timer } from 'rxjs';
import { faker } from '@faker-js/faker';

const elk = new ELK();

interface IGroup {
  id: string;
  size: ISize;
  position?: IPoint;
}

interface INode {
  id: string;
  size: ISize;
  position?: IPoint;
  parentId: string | null;
}

interface IEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

@Component({
  selector: 'app-root',
  imports: [FFlowModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  @ViewChild(FCanvasComponent, { static: true })
  public fCanvas!: FCanvasComponent;

  @ViewChildren(FGroupDirective)
  public fGroup!: QueryList<FGroupDirective>;

  @ViewChildren(FNodeDirective)
  public fNodes!: QueryList<FNodeDirective>;

  protected readonly eResizeHandleType = EFResizeHandleType;

  // Signals for ELK layout results
  public elkGroups = signal<IGroup[]>([]);
  public elkNodes = signal<INode[]>([]);
  public elkEdges = signal<IEdge[]>([]);

  // Signals for initial Foblex data
  public foblexGroups = signal<IGroup[]>([]);
  public foblexNodes = signal<INode[]>([]);
  public foblexEdges = signal<IEdge[]>([]);

  // Configuration
  private enableGroups = true; // Set to false to disable groups
  private groupCount = 20; // Number of groups to create

  // Zoom and stroke compensation
  private baseStrokeWidth = 2; // Base stroke width in pixels
  private currentZoomScale = 1; // Current zoom scale

  public ngOnInit(): void {
    if (this.enableGroups) {
      this.createGroups(this.groupCount);
    } else {
      // Create root-level nodes only
      this.createRootNodes(50); // Create 50 root-level nodes
    }

    this.foblexEdges.set(
      this.createRandomWiredEdges(
        this.foblexNodes(),
        this.foblexNodes().length / 3
      )
    );
  }

  // #region Foblex Events

  private isLoaded = false;

  public onLoaded(): void {
    if (this.isLoaded) {
      return;
    }

    this.isLoaded = true;

    timer(1000).subscribe(() => {
      this.elkLayout();
    });
  }

  public onCanvasChange(event: any): void {
    // Extract zoom scale from the canvas transform
    const scale = event.scale || 1;
    this.currentZoomScale = scale;

    // Apply stroke width compensation
    this.updateStrokeCompensation();
  }

  private updateStrokeCompensation(): void {
    // Apply to all connection paths (SVG elements)
    const connectionPaths = document.querySelectorAll('.f-connection-path');
    connectionPaths.forEach((path: Element) => {
      // Use setAttribute for SVG elements to ensure proper rendering
      (path as SVGPathElement).setAttribute('stroke-width', '2');
    });
  }

  // #endregion

  // #region Elk Methods

  public elkLayout(): void {
    // Build hierarchical structure for ELK.js (only if groups enabled)
    const groups = this.enableGroups
      ? this.foblexGroups().map(group => {
          const children = this.foblexNodes()
            .filter(node => node.parentId === group.id)
            .map(node => ({
              id: node.id,
              width: node.size.width,
              height: node.size.height,
              type: 'node',
            }));

          return {
            id: group.id,
            type: 'group',
            layoutOptions: {
              // Core algorithm
              'elk.algorithm': 'layered',
              'elk.direction': 'RIGHT',

              // Padding
              'elk.padding': '[top=50,left=50,bottom=50,right=50]',

              // Node spacing
              'elk.spacing.nodeNode': '50',
              'elk.layered.spacing.nodeNodeBetweenLayers': '50',
              'elk.spacing.componentComponent': '70',

              // Node sizing
              'elk.nodeSize.constraints': 'NODE_LABELS MINIMUM_SIZE',

              // Layered algorithm specific options
              'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
              'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
              'elk.layered.cycleBreaking.strategy': 'GREEDY',
              'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',

              // Edge routing
              'elk.edgeRouting': 'ORTHOGONAL',
              'elk.layered.edgeRouting.selfLoopPlacement': 'NORTH_STACKED',

              // Port constraints
              'elk.portConstraints': 'FIXED_SIDE',

              // Hierarchy handling
              'elk.hierarchyHandling': 'INCLUDE_CHILDREN',

              // Consider model order for better stability
              'elk.considerModelOrder.strategy': 'NODES_AND_EDGES',
            },
            // Nest child nodes inside their parent groups
            children: children,
            // Add edges between nodes within this group
            edges: this.foblexEdges()
              .filter(edge => {
                const sourceNode = this.foblexNodes().find(
                  n => n.id === edge.source
                );
                const targetNode = this.foblexNodes().find(
                  n => n.id === edge.target
                );
                return (
                  sourceNode?.parentId === group.id &&
                  targetNode?.parentId === group.id
                );
              })
              .map(edge => ({
                id: edge.id,
                sources: [edge.source],
                targets: [edge.target],
              })),
          };
        })
      : [];

    // Root-level nodes (no parent)
    const rootNodes = this.foblexNodes()
      .filter(node => !node.parentId)
      .map(node => ({
        id: node.id,
        width: node.size.width,
        height: node.size.height,
        type: 'node',
      }));

    // Root-level edges
    const rootEdges = this.enableGroups
      ? this.foblexEdges()
          .filter(edge => {
            const sourceNode = this.foblexNodes().find(
              n => n.id === edge.source
            );
            const targetNode = this.foblexNodes().find(
              n => n.id === edge.target
            );
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
          }))
      : this.foblexEdges().map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        }));

    const graph = {
      id: 'root',
      layoutOptions: {
        // Core algorithm
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',

        // Spacing
        'elk.spacing.nodeNode': '80',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
        'elk.spacing.componentComponent': '100',
        'elk.spacing.edgeNode': '40',
        'elk.spacing.edgeEdge': '20',

        // Layered algorithm options
        'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.cycleBreaking.strategy': 'GREEDY',
        'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
        'elk.layered.thoroughness': '10',

        // Edge routing
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.edgeRouting.selfLoopPlacement': 'NORTH_STACKED',

        // Separate connected components
        'elk.separateConnectedComponents': 'true',

        // Port constraints
        'elk.portConstraints': 'FIXED_SIDE',

        // Hierarchy handling
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',

        // Consider model order
        'elk.considerModelOrder.strategy': 'NODES_AND_EDGES',

        // Interactive mode for better incremental layout
        'elk.interactiveLayout': 'true',
      },
      children: [...groups, ...rootNodes],
      edges: rootEdges,
    };

    elk
      .layout(graph)
      .then(result => {
        // Extract groups from result (only if groups enabled)
        const groups = this.enableGroups
          ? (result?.children?.filter(
              (node: any) => node.type === 'group'
            ) as any) || []
          : [];

        if (this.enableGroups) {
          this.elkGroups.set(
            groups.map((group: any) => ({
              id: group.id,
              size: {
                width: group.width,
                height: group.height,
              },
              position: PointExtensions.initialize(group.x || 0, group.y || 0),
            })) as IGroup[]
          );
        }

        // Extract all nodes - both from groups and root level
        const allNodes: INode[] = [];

        // Process nodes inside groups (only if groups enabled)
        if (this.enableGroups) {
          groups.forEach((group: any) => {
            if (group.children) {
              group.children.forEach((node: any) => {
                // Calculate absolute position by adding group position to node's relative position
                const absoluteX = (group.x || 0) + (node.x || 0);
                const absoluteY = (group.y || 0) + (node.y || 0);

                allNodes.push({
                  id: node.id,
                  size: {
                    width: node.width,
                    height: node.height,
                  },
                  // Position includes group position for absolute coordinates
                  position: PointExtensions.initialize(absoluteX, absoluteY),
                  parentId: group.id,
                });
              });
            }
          });
        }

        // Process root-level nodes (positions are absolute)
        const rootNodes =
          result?.children?.filter((node: any) => node.type === 'node') || [];
        rootNodes.forEach((node: any) => {
          allNodes.push({
            id: node.id,
            size: {
              width: node.width,
              height: node.height,
            },
            position: PointExtensions.initialize(node.x || 0, node.y || 0),
            parentId: null,
          });
        });

        this.elkNodes.set(allNodes);

        this.elkEdges.set(
          (result?.edges as any).map((edge: any) => ({
            id: edge.id,
            source: edge.sources[0],
            target: edge.targets[0],
          })) as IEdge[]
        );

        timer(250).subscribe(() => {
          this.fCanvas.fitToScreen(PointExtensions.initialize(100, 100), false);

          // Apply initial stroke compensation after layout
          timer(100).subscribe(() => {
            this.updateStrokeCompensation();
          });
        });
      })
      .catch(console.error);
  }

  // #endregion

  // #region Mock Methods

  private createGroups(count: number): IGroup[] {
    const groups = Array.from({ length: count }).map(() => {
      return {
        id: uuidv4(),
        // Minimum initial size - ELK will expand based on children
        size: { width: 200, height: 200 },
      };
    });

    this.foblexGroups.set(groups);

    // Create nodes for each group - they belong to that specific group
    groups.forEach(group => {
      this.foblexNodes.update(nodes => [
        ...nodes,
        ...this.createNodesForGroup(group.id),
      ]);
    });

    // Create some root-level nodes (no parent)
    this.foblexNodes.update(nodes => [
      ...nodes,
      ...this.createNodesForGroup(null),
    ]);

    return groups;
  }

  private createRootNodes(count: number): void {
    const nodes = Array.from({ length: count }).map(() => {
      const size = {
        width: faker.number.int({ min: 100, max: 350 }),
        height: faker.number.int({ min: 100, max: 350 }),
      };

      return {
        id: uuidv4(),
        size,
        position: PointExtensions.initialize(0, 0), // Initial position before layout
        parentId: null, // No parent - root level
      };
    });

    this.foblexNodes.set(nodes);
  }

  private createNodesForGroup(parentId: string | null): INode[] {
    const randomNodeCount = faker.number.int({ min: 3, max: 10 });

    return Array.from({ length: randomNodeCount }).map(() => {
      const size = {
        width: faker.number.int({ min: 100, max: 350 }),
        height: faker.number.int({ min: 100, max: 350 }),
      };

      return {
        id: uuidv4(),
        size,
        parentId, // Keep the node in its assigned group
      };
    });
  }

  private createRandomWiredEdges = (
    nodes: INode[],
    totalConnections: number
  ): IEdge[] => {
    const edges: IEdge[] = [];

    // Make sure we have nodes to connect
    if (nodes.length < 2) {
      return edges;
    }

    for (let i = 0; i < totalConnections; i++) {
      // Make sure we don't exceed the array bounds
      const maxIndex = Math.max(0, nodes.length - 1);
      const sourceIndex = faker.number.int({ min: 0, max: maxIndex });
      const targetIndex = faker.number.int({ min: 0, max: maxIndex });

      // Make sure nodes exist
      if (!nodes[sourceIndex] || !nodes[targetIndex]) {
        continue;
      }

      const sourceId = nodes[sourceIndex].id;
      const targetId = nodes[targetIndex].id;

      edges.push({
        id: uuidv4(),
        source: sourceId,
        target: targetId,
        sourceHandle: sourceId,
        targetHandle: targetId,
      });
    }

    return edges as IEdge[];
  };

  // #endregion
}
