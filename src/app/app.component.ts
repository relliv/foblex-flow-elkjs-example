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

  // Zoom and stroke compensation
  private baseStrokeWidth = 2; // Base stroke width in pixels
  private currentZoomScale = 1; // Current zoom scale

  // Layout direction
  public selectedDirection = signal<'RIGHT' | 'DOWN' | 'LEFT' | 'UP'>('DOWN');
  public directionOptions = [
    { value: 'RIGHT', label: 'Left to Right' },
    { value: 'DOWN', label: 'Top to Bottom' },
    { value: 'LEFT', label: 'Right to Left' },
    { value: 'UP', label: 'Bottom to Top' },
  ] as const;

  // Layout algorithm
  public selectedAlgorithm = signal<'layered' | 'force' | 'stress' | 'mrtree'>('layered');
  public algorithmOptions = [
    { value: 'layered', label: 'Layered (Hierarchical)' },
    { value: 'force', label: 'Force-Directed (Organic)' },
    { value: 'stress', label: 'Stress (Minimized Edge Length)' },
    { value: 'mrtree', label: 'Tree (MR-Tree)' },
  ] as const;

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

  public onLoaded(): void {
    this.elkLayout();
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
          enableGroups: this.enableGroups,
        },
        {
          algorithm: this.selectedAlgorithm(),
          direction: this.selectedDirection(),
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
