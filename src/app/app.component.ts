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

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [FFlowModule],
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
  private enableGroups = true; // Set to false to disable groups
  private groupCount = 20; // Number of groups to create

  // Layout direction
  public selectedDirection = signal<'RIGHT' | 'DOWN' | 'LEFT' | 'UP'>('DOWN');
  public directionOptions = [
    { value: 'RIGHT', label: 'Left to Right' },
    { value: 'DOWN', label: 'Top to Bottom' },
    { value: 'LEFT', label: 'Right to Left' },
    { value: 'UP', label: 'Bottom to Top' },
  ] as const;

  // Layout algorithm
  public selectedAlgorithm = signal<'layered' | 'force' | 'stress' | 'mrtree'>(
    'layered'
  );
  public algorithmOptions = [
    { value: 'layered', label: 'Layered (Hierarchical)' },
    { value: 'force', label: 'Force-Directed (Organic)' },
    { value: 'stress', label: 'Stress (Minimized Edge Length)' },
    { value: 'mrtree', label: 'Tree (MR-Tree)' },
  ] as const;

  // Edge routing
  public selectedEdgeRouting = signal<'ORTHOGONAL' | 'POLYLINE' | 'SPLINES'>('ORTHOGONAL');
  public edgeRoutingOptions = [
    { value: 'ORTHOGONAL', label: 'Orthogonal (90° angles)' },
    { value: 'POLYLINE', label: 'Polyline (straight segments)' },
    { value: 'SPLINES', label: 'Splines (curved)' },
  ] as const;

  // Node placement strategy (for layered algorithm)
  public selectedNodePlacement = signal<'NETWORK_SIMPLEX' | 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS'>('NETWORK_SIMPLEX');
  public nodePlacementOptions = [
    { value: 'NETWORK_SIMPLEX', label: 'Network Simplex' },
    { value: 'BRANDES_KOEPF', label: 'Brandes Koepf' },
    { value: 'LINEAR_SEGMENTS', label: 'Linear Segments' },
  ] as const;

  // Node spacing
  public nodeSpacing = signal<number>(80);
  public layerSpacing = signal<number>(80);

  // Group padding
  public groupPadding = signal<number>(60);

  // Enable/disable groups toggle
  public enableGroupsSignal = signal<boolean>(this.enableGroups);

  public ngOnInit(): void {
    // Always create some default root nodes at the beginning
    this.createRootNodes(10); // Create 10 default root-level nodes

    if (this.enableGroupsSignal()) {
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
      const layoutResult = await this.elkLayoutService.calculateLayout(
        {
          groups: this.foblexGroups(),
          nodes: this.foblexNodes(),
          edges: this.foblexEdges(),
          enableGroups: this.enableGroupsSignal(),
        },
        {
          algorithm: this.selectedAlgorithm(),
          direction: this.selectedDirection(),
          edgeRouting: this.selectedEdgeRouting(),
          nodePlacement: this.selectedNodePlacement(),
          spacing: {
            nodeNode: this.nodeSpacing(),
            nodeNodeBetweenLayers: this.layerSpacing(),
            componentComponent: 100,
            edgeNode: 40,
            edgeEdge: 20,
          },
          groupPadding: {
            top: this.groupPadding(),
            right: this.groupPadding(),
            bottom: this.groupPadding(),
            left: this.groupPadding(),
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
   * Handles direction change from UI
   */
  public onDirectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const direction = target.value as 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
    this.selectedDirection.set(direction);
    this.elkLayout();
  }

  /**
   * Handles algorithm change from UI
   */
  public onAlgorithmChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const algorithm = target.value as 'layered' | 'force' | 'stress' | 'mrtree';
    this.selectedAlgorithm.set(algorithm);
    this.elkLayout();
  }

  /**
   * Handles edge routing change from UI
   */
  public onEdgeRoutingChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const routing = target.value as 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
    this.selectedEdgeRouting.set(routing);
    this.elkLayout();
  }

  /**
   * Handles node placement change from UI
   */
  public onNodePlacementChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const placement = target.value as 'NETWORK_SIMPLEX' | 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS';
    this.selectedNodePlacement.set(placement);
    this.elkLayout();
  }

  /**
   * Handles node spacing change from UI
   */
  public onNodeSpacingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const spacing = parseInt(target.value, 10);
    this.nodeSpacing.set(spacing);
    this.elkLayout();
  }

  /**
   * Handles layer spacing change from UI
   */
  public onLayerSpacingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const spacing = parseInt(target.value, 10);
    this.layerSpacing.set(spacing);
    this.elkLayout();
  }

  /**
   * Handles group padding change from UI
   */
  public onGroupPaddingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const padding = parseInt(target.value, 10);
    this.groupPadding.set(padding);
    this.elkLayout();
  }

  /**
   * Handles enable groups toggle from UI
   */
  public onEnableGroupsChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.enableGroupsSignal.set(target.checked);

    // Re-create the graph structure
    this.foblexGroups.set([]);
    this.foblexNodes.set([]);
    this.foblexEdges.set([]);

    // Always create some default root nodes
    this.createRootNodes(10);

    if (target.checked) {
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
