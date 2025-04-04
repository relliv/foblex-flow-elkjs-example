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
    this.foblexGroups = this.createGroups(20);
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
    const graph = {
      id: 'root',
      layoutOptions: { 'elk.algorithm': 'layered' },
      children: [
        ...this.foblexGroups.map(group => ({
          id: group.id,
          width: group.size.width,
          height: group.size.height,
          type: 'group',
          parentId: null,
        })),
        ...this.foblexNodes.map(node => ({
          id: node.id,
          width: node.size.width,
          height: node.size.height,
          type: 'node',
          parentId: node.parentId,
        })),
      ],
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
        this.elkGroups = (
          result?.children?.filter(node => node.type === 'group') as any
        ).map((node: any) => ({
          id: node.id,
          size: {
            width: node.width,
            height: node.height,
          },
          position: {
            x: node.x,
            y: node.y,
          },
        })) as IGroup[];

        this.elkNodes = (
          result?.children?.filter(node => node.type === 'node') as any
        ).map((node: any) => ({
          id: node.id,
          size: {
            width: node.width,
            height: node.height,
          },
          position: {
            x: node.x,
            y: node.y,
          },
          parentId: node.parentId,
        })) as INode[];

        this.elkEdges = (result?.edges as any).map((edge: any) => ({
          id: edge.id,
          source: edge.sources[0],
          target: edge.targets[0],
        })) as IEdge[];

        console.log(this.elkGroups);
        console.log(this.elkNodes);
        console.log(this.elkEdges);

        this.fCanvas.fitToScreen(PointExtensions.initialize(50, 50), false);

        this.changeDetectorRef.detectChanges();
      })
      .catch(console.error);
  }

  // #endregion

  // #region Mock Methods

  private createGroups(count: number): IGroup[] {
    return Array.from({ length: count }).map(() => {
      this.foblexNodes.push(...this.createNodes());

      const size = {
        width: faker.number.int({ min: 400, max: 550 }),
        height: faker.number.int({ min: 400, max: 550 }),
      };

      return {
        id: uuidv4(),
        size,
      };
    });
  }

  private createNodes(): INode[] {
    const randomNodeCount = Math.random() * 20;

    return Array.from({ length: randomNodeCount }).map(() => {
      let parentId = null;

      if (Math.random() > 0.5) {
        parentId =
          this.foblexGroups[
            Math.floor(Math.random() * this.foblexGroups.length)
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
