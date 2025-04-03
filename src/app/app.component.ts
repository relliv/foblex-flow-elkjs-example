import { Component, OnInit, ViewChild } from '@angular/core';
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

  public ngOnInit(): void {
    this.foblexGroups = this.createGroups(20);
    this.foblexEdges = this.createRandomWiredEdges(
      this.foblexNodes,
      this.foblexNodes.length / 3
    );
  }

  // #region Foblex Events

  public onLoaded(): void {
    this.fCanvas.fitToScreen(PointExtensions.initialize(50, 50), false);

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
        ...this.foblexGroups.map((group) => ({
          id: group.id,
          width: group.size.width,
          height: group.size.height,
          type: 'group',
          parentId: null,
        })),
        ...this.foblexNodes.map((node) => ({
          id: node.id,
          width: node.size.width,
          height: node.size.height,
          type: 'node',
          parentId: node.parentId,
        })),
      ],
      edges: [
        ...this.foblexEdges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      ],
    };

    elk.layout(graph).then(console.log).catch(console.error);
  }

  // #endregion

  // #region Mock Methods

  private createGroups(count: number): IGroup[] {
    return Array.from({ length: count }).map(() => {
      this.foblexNodes.push(...this.createNodes());

      const size = {
        width: Math.random() * 200,
        height: Math.random() * 200,
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
        width: Math.random() * 250,
        height: Math.random() * 150,
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

    for (let i = 0; i < totalConnections; i++) {
      const sourceNode: any =
          nodes[faker.number.int({ min: 0, max: this.foblexNodes.length - 1 })],
        targetNode: any =
          nodes[faker.number.int({ min: 0, max: this.foblexNodes.length - 1 })],
        sourceId = sourceNode.id,
        targetId = targetNode.id;

      edges.push({
        id: uuidv4(),
        source: sourceId,
        target: targetId,
        sourceHandle: 'output-' + sourceId,
        targetHandle: 'input-' + targetId,
      });
    }

    return edges as IEdge[];
  };

  // #endregion
}
