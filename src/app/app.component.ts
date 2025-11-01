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

  public ngOnInit(): void {
    this.createGroups(20);
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

  // #endregion

  // #region Elk Methods

  public elkLayout(): void {
    // Build hierarchical structure for ELK.js
    const groups = this.foblexGroups().map(group => ({
      id: group.id,
      type: 'group',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.padding': '[top=50,left=50,bottom=50,right=50]',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '50',
      },
      // Nest child nodes inside their parent groups
      children: this.foblexNodes()
        .filter(node => node.parentId === group.id)
        .map(node => ({
          id: node.id,
          width: node.size.width,
          height: node.size.height,
          type: 'node',
        })),
    }));

    // Root-level nodes (no parent)
    const rootNodes = this.foblexNodes()
      .filter(node => !node.parentId)
      .map(node => ({
        id: node.id,
        width: node.size.width,
        height: node.size.height,
        type: 'node',
      }));

    const graph = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': '80',
        'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      },
      children: [...groups, ...rootNodes],
      edges: [
        ...this.foblexEdges().map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      ],
    };

    console.log('Input graph to ELK:', JSON.stringify(graph, null, 2));

    elk
      .layout(graph)
      .then(result => {
        console.log('ELK Result:', JSON.stringify(result, null, 2));
        // Extract groups from result
        const groups =
          (result?.children?.filter(
            (node: any) => node.type === 'group'
          ) as any) || [];

        this.elkGroups.set(
          groups.map((group: any) => ({
            id: group.id,
            size: {
              width: group.width,
              height: group.height,
            },
            position: {
              x: group.x || 0,
              y: group.y || 0,
            },
          })) as IGroup[]
        );

        // Extract all nodes - both from groups and root level
        const allNodes: INode[] = [];

        // Process nodes inside groups (positions are relative to group)
        groups.forEach((group: any) => {
          if (group.children) {
            group.children.forEach((node: any) => {
              allNodes.push({
                id: node.id,
                size: {
                  width: node.width,
                  height: node.height,
                },
                position: {
                  x: node.x || 0,
                  y: node.y || 0,
                },
                parentId: group.id,
              });
            });
          }
        });

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
            position: {
              x: node.x || 0,
              y: node.y || 0,
            },
            parentId: null,
          });
        });

        this.elkNodes.set(allNodes);

        timer(2000).subscribe(() => {
          // Force update groups
          this.fGroup.forEach(group => {
            console.log('Group position:', group._position);
            group._position = {
              x: group.position().x,
              y: group.position().y,
            };
            group.redraw();
            group.refresh();
          });

          // Force update nodes
          this.fNodes.forEach(node => {
            console.log('Node position:', node._position);
            node._position = {
              x: node.position().x,
              y: node.position().y,
            };
            node.redraw();
            node.refresh();
          });

          // Redraw canvas
          this.fCanvas.redraw();
        });

        this.elkEdges.set(
          (result?.edges as any).map((edge: any) => ({
            id: edge.id,
            source: edge.sources[0],
            target: edge.targets[0],
          })) as IEdge[]
        );

        console.log('=== Final Data ===');
        console.log('ELK Groups:', this.elkGroups());
        console.log('ELK Nodes:', this.elkNodes());
        console.log('ELK Edges:', this.elkEdges());
        console.log(
          'Sample node positions:',
          this.elkNodes()
            .slice(0, 3)
            .map(n => ({ id: n.id, pos: n.position }))
        );

        timer(250).subscribe(() => {
          this.fCanvas.fitToScreen(PointExtensions.initialize(100, 100), false);
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
