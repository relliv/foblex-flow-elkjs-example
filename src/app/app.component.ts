import {
  Component,
  inject,
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
  FNodeDirective,
} from '@foblex/flow';
import { PointExtensions } from '@foblex/2d';
import { v4 as uuidv4 } from 'uuid';
import { timer } from 'rxjs';
import { faker } from '@faker-js/faker';
import { IEdge, IGroup, INode } from './models/graph.interface';
import { ElkLayoutService } from './services/elk-layout.service';
import { LayoutControlsComponent, LayoutConfig } from './components/layout-controls/layout-controls.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [FFlowModule, LayoutControlsComponent],
})
export class AppComponent implements OnInit {
  // Dependency injection
  private readonly elkLayoutService = inject(ElkLayoutService);

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
  private groupCount = 20; // Number of groups to create

  // Layout configuration
  public layoutConfig = signal<LayoutConfig>({
    enableGroups: true,
    algorithm: 'layered',
    direction: 'DOWN',
    edgeRouting: 'ORTHOGONAL',
    nodePlacement: 'NETWORK_SIMPLEX',
    nodeSpacing: 80,
    layerSpacing: 80,
    groupPadding: 60,
  });

  public ngOnInit(): void {
    // Always create some default root nodes at the beginning
    this.createRootNodes(10); // Create 10 default root-level nodes

    if (this.layoutConfig().enableGroups) {
      this.createGroups(this.groupCount);
    } else {
      // Create additional root-level nodes when groups are disabled
      this.createRootNodes(40); // Create 40 more root-level nodes
    }

    this.foblexEdges.set(
      this.createRandomWiredEdges(
        this.foblexNodes(),
        this.foblexNodes().length / 3
      )
    );
  }

  // #region Foblex Events

  public onLoaded(): void {
    this.elkLayout();
  }

  public onCanvasChange(event: any): void {
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

  // #region Layout Methods

  /**
   * Performs graph layout using ELK.js service
   * Delegates complex layout logic to the ElkLayoutService
   */
  public async elkLayout(): Promise<void> {
    try {
      const config = this.layoutConfig();
      const layoutResult = await this.elkLayoutService.calculateLayout(
        {
          groups: this.foblexGroups(),
          nodes: this.foblexNodes(),
          edges: this.foblexEdges(),
          enableGroups: config.enableGroups,
        },
        {
          algorithm: config.algorithm,
          direction: config.direction,
          edgeRouting: config.edgeRouting,
          nodePlacement: config.nodePlacement,
          spacing: {
            nodeNode: config.nodeSpacing,
            nodeNodeBetweenLayers: config.layerSpacing,
            componentComponent: 100,
            edgeNode: 40,
            edgeEdge: 20,
          },
          groupPadding: {
            top: config.groupPadding,
            right: config.groupPadding,
            bottom: config.groupPadding,
            left: config.groupPadding,
          },
        }
      );

      // Update signals with calculated positions
      this.elkGroups.set(layoutResult.groups);
      this.elkNodes.set(layoutResult.nodes);
      this.elkEdges.set(layoutResult.edges);

      // Fit canvas to screen after layout
      timer(250).subscribe(() => {
        this.fCanvas.fitToScreen(PointExtensions.initialize(100, 100), false);

        // Apply initial stroke compensation after layout
        timer(500).subscribe(() => {
          this.updateStrokeCompensation();
        });
      });
    } catch (error) {
      console.error('Layout calculation failed:', error);
    }
  }

  /**
   * Handles configuration changes from layout controls
   */
  public onConfigChange(changes: Partial<LayoutConfig>): void {
    this.layoutConfig.update(config => ({ ...config, ...changes }));
    this.elkLayout();
  }

  /**
   * Handles regenerate graph request (when groups toggle changes)
   */
  public onRegenerateGraph(enableGroups: boolean): void {
    // Update config
    this.layoutConfig.update(config => ({ ...config, enableGroups }));

    // Re-create the graph structure
    this.foblexGroups.set([]);
    this.foblexNodes.set([]);
    this.foblexEdges.set([]);

    // Always create some default root nodes
    this.createRootNodes(10);

    if (enableGroups) {
      this.createGroups(this.groupCount);
    } else {
      // Create additional root-level nodes when groups are disabled
      this.createRootNodes(40);
    }

    this.foblexEdges.set(
      this.createRandomWiredEdges(
        this.foblexNodes(),
        this.foblexNodes().length / 3
      )
    );

    this.elkLayout();
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

    // Root-level nodes are now created in ngOnInit before this method is called

    return groups;
  }

  private createRootNodes(count: number): void {
    const newNodes = Array.from({ length: count }).map(() => {
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

    // Append to existing nodes instead of replacing
    this.foblexNodes.update(nodes => [...nodes, ...newNodes]);
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
