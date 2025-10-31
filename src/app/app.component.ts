import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import {
  EFResizeHandleType,
  FCanvasComponent,
  FFlowModule,
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

  protected readonly eResizeHandleType = EFResizeHandleType;

  public elkGroups: IGroup[] = [];
  public elkNodes: INode[] = [];
  public elkEdges: IEdge[] = [];

  public foblexGroups: IGroup[] = [];
  public foblexNodes: INode[] = [];
  public foblexEdges: IEdge[] = [];

  public constructor(private changeDetectorRef: ChangeDetectorRef) {}

  public ngOnInit(): void {
    this.createGroups(20);
    this.foblexEdges = this.createRandomWiredEdges(
      this.foblexNodes,
      this.foblexNodes.length / 3
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
    const groups = this.foblexGroups.map(group => ({
      id: group.id,
      type: 'group',
      layoutOptions: {
        'elk.padding': '[top=50,left=50,bottom=50,right=50]',
      },
      // Nest child nodes inside their parent groups
      children: this.foblexNodes
        .filter(node => node.parentId === group.id)
        .map(node => ({
          id: node.id,
          width: node.size.width,
          height: node.size.height,
          type: 'node',
        })),
    }));

    // Root-level nodes (no parent)
    const rootNodes = this.foblexNodes
      .filter(node => !node.parentId)
      .map(node => ({
        id: node.id,
        width: node.size.width,
        height: node.size.height,
        type: 'node',
      }));

    const graph = {
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered' },
      children: [...groups, ...rootNodes],
      edges: [
        ...this.foblexEdges.map(edge => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      ],
    };

    elk
      .layout(graph)
      .then(result => {
        // Extract groups from result
        const groups = (result?.children?.filter((node: any) => node.type === 'group') as any) || [];

        this.elkGroups = groups.map((group: any) => ({
          id: group.id,
          size: {
            width: group.width,
            height: group.height,
          },
          position: {
            x: group.x || 0,
            y: group.y || 0,
          },
        })) as IGroup[];

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
        const rootNodes = result?.children?.filter((node: any) => node.type === 'node') || [];
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

        this.elkNodes = allNodes;

        this.elkEdges = (result?.edges as any).map((edge: any) => ({
          id: edge.id,
          source: edge.sources[0],
          target: edge.targets[0],
        })) as IEdge[];

        console.log('ELK Groups:', this.elkGroups);
        console.log('ELK Nodes:', this.elkNodes);
        console.log('ELK Edges:', this.elkEdges);

        timer(250).subscribe(() => {
          this.fCanvas.fitToScreen(PointExtensions.initialize(100, 100), false);
        });

        this.changeDetectorRef.detectChanges();
      })
      .catch(console.error);
  }

  // #endregion

  // #region Mock Methods

  private createGroups(count: number): IGroup[] {
    this.foblexGroups = Array.from({ length: count }).map(() => {
      return {
        id: uuidv4(),
        // Minimum initial size - ELK will expand based on children
        size: { width: 200, height: 200 },
      };
    });

    this.foblexGroups.forEach(() => {
      this.foblexNodes.push(...this.createNodes());
    });

    return this.foblexGroups;
  }

  private createNodes(): INode[] {
    const randomNodeCount = Math.random() * 20;

    return Array.from({ length: randomNodeCount }).map(() => {
      let parentId = null;

      console.log(this.foblexGroups.length);

      if (Math.random() > 0.5) {
        parentId =
          this.foblexGroups[
            faker.number.int({ min: 0, max: this.foblexGroups.length - 1 })
          ]?.id;
      }

      const size = {
        width: faker.number.int({ min: 100, max: 350 }),
        height: faker.number.int({ min: 100, max: 350 }),
      };

      return {
        id: uuidv4(),
        size,
        parentId,
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
