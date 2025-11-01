# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a proof of concept Angular application demonstrating the integration of Foblex Flow with ELK.js (Eclipse Layout Kernel) for automatic graph layout with group support. The project showcases hierarchical node-based flow diagrams with automatic layout capabilities.

## Technology Stack

- **Angular 19** - Modern Angular with standalone components and signals
- **Foblex Flow** - Flow diagram library for node-based UIs
- **ELK.js** - Automatic graph layout engine (layered algorithm)
- **pnpm** - Package manager (version 9.15.9+)
- **TypeScript 5.7** - Strict mode enabled
- **Angular Signals** - Reactive state management (no Zone.js change detection needed)

## Common Commands

### Development
```bash
pnpm start              # Start dev server on port 2000
pnpm run build          # Production build
pnpm run watch          # Build in watch mode (development)
pnpm run test           # Run tests with Karma
```

### Server-Side Rendering
```bash
pnpm run build          # Build first
pnpm run serve:ssr:foblex-flow-elkjs-example  # Run SSR server
```

## Architecture

### SOLID Principles Implementation

The application follows SOLID principles with clear separation of concerns:

1. **Single Responsibility**: Each class has one reason to change
   - `AppComponent`: UI presentation and user interactions
   - `ElkLayoutService`: Graph layout calculations
   - `graph.interface.ts`: Type definitions and contracts

2. **Open/Closed**: Extended through configuration, not modification
   - Layout options can be customized without changing service code
   - New layout algorithms supported through configuration

3. **Dependency Inversion**: Components depend on abstractions (interfaces)
   - Component depends on `ElkLayoutService` interface
   - Layout input/output defined by interfaces

### Core Flow

The application follows this data flow pattern:

1. **Initial Data Generation** (`ngOnInit` in AppComponent):
   - Creates random groups using Faker.js
   - Generates nodes with random dimensions and optional parent group assignments
   - Creates random edges connecting nodes

2. **Layout Calculation** (`ElkLayoutService.calculateLayout`):
   - Receives layout input data (groups, nodes, edges, configuration)
   - Converts Foblex data structures to ELK.js hierarchical graph format
   - Child nodes are nested inside their parent groups (not a flat list)
   - Groups are passed without width/height - ELK.js calculates sizes based on children
   - ELK.js computes positions using layered algorithm with configurable padding
   - Results are flattened back to Foblex format (child positions converted to absolute)
   - Returns calculated positions through `ILayoutOutput` interface

3. **Rendering** (AppComponent template):
   - Template conditionally renders nodes inside their parent groups
   - Nodes without parents render at root level
   - Edges connect nodes via input/output handles
   - Canvas auto-fits to display all content

### File Structure

```
src/app/
├── models/
│   └── graph.interface.ts       # Type definitions for graph elements
├── services/
│   └── elk-layout.service.ts    # ELK.js layout calculation service
├── app.component.ts              # Main component (presentation logic)
├── app.component.html            # Template
├── app.component.scss            # Component styles
└── common.scss                   # Global styles
```

### Key Interfaces

**Located in** `src/app/models/graph.interface.ts`:

```typescript
interface IGroup {
  id: string;
  size: ISize;
  position?: IPoint;
}

interface INode {
  id: string;
  size: ISize;
  position?: IPoint;
  parentId: string | null;  // null = root level, otherwise group ID
}

interface IEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
}

interface ILayoutInput {
  groups: IGroup[];
  nodes: INode[];
  edges: IEdge[];
  enableGroups: boolean;
}

interface ILayoutOutput {
  groups: IGroup[];
  nodes: INode[];
  edges: IEdge[];
}

interface IElkLayoutOptions {
  algorithm?: 'layered' | 'force' | 'stress' | 'mrtree';
  direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  spacing?: {
    nodeNode?: number;
    nodeNodeBetweenLayers?: number;
    componentComponent?: number;
    edgeNode?: number;
    edgeEdge?: number;
  };
  groupPadding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  edgeRouting?: 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
  nodePlacement?: 'NETWORK_SIMPLEX' | 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS';
}
```

### Service Layer

**ElkLayoutService** (`src/app/services/elk-layout.service.ts`):
- Injectable service with `providedIn: 'root'`
- Encapsulates all ELK.js layout logic
- **Public API**:
  - `calculateLayout(input: ILayoutInput, options?: Partial<IElkLayoutOptions>): Promise<ILayoutOutput>`
- **Responsibilities**:
  - Build hierarchical ELK graph structure from flat input data
  - Configure ELK.js layout options (algorithm, spacing, routing)
  - Execute layout calculation
  - Extract and flatten results (convert relative to absolute positions)
  - Handle errors gracefully
- **Benefits**:
  - Reusable across different components
  - Testable in isolation
  - Configurable through options parameter
  - Hides ELK.js complexity from consumers

### Component Structure

**AppComponent** (`src/app/app.component.ts`):
- Presentation-focused component using Angular signals
- **Dependency Injection**:
  - Injects `ElkLayoutService` using `inject()` function
- **Reactive state with signals**:
  - `foblexGroups/Nodes/Edges` - Signals holding initial random data
  - `elkGroups/Nodes/Edges` - Signals holding layout-calculated positions
  - All updates use `.set()` or `.update()` methods
  - Template reads signal values with `()`  syntax (e.g., `elkGroups()`)
- **Key methods**:
  - `createGroups()` - Generates random groups and their child nodes
  - `createNodesForGroup()` - Creates 3-10 nodes for a specific group (or root level if null)
  - `createRandomWiredEdges()` - Generates random connections
  - `elkLayout()` - Calls `ElkLayoutService.calculateLayout()` and updates signals (simplified from 200+ lines to 20 lines)
  - `onLoaded()` - Triggers layout after canvas initialization
  - `onCanvasChange()` - Handles zoom events for stroke width compensation
  - `updateStrokeCompensation()` - Maintains constant 2px stroke width at all zoom levels

### Template Architecture

The template (`src/app/app.component.html`) uses nested @for loops:
1. Iterates over `elkGroups` to render group containers
2. Inside each group, iterates `elkNodes` filtering by `parentId`
3. Separately renders root-level nodes (where `parentId === null`)
4. Renders all edges with fixed center behavior

### Foblex Flow Integration

- **Canvas**: `<f-canvas>` with zoom support
  - Zoom step: 0.4 (faster zooming)
  - Maximum zoom: 1.5x (150%)
  - Minimum zoom: 0.1x (10%)
  - Canvas change events for zoom tracking
- **Groups**: `fGroup` directive with drag handles
- **Nodes**: `fNode` directive with position/size binding
- **Handles**: `fNodeInput` (left) and `fNodeOutput` (right) for connections
- **Connections**: `f-connection` with segment type and fixed center behavior
- **Background**: Circle pattern overlay

### Dynamic Stroke Width Compensation

**Problem**: SVG path strokes become invisible when zooming out due to parent element scaling via `transform: matrix()`.

**Solution**: The application implements dynamic stroke width compensation that inversely scales with zoom level to maintain consistent visual appearance.

#### Implementation Details

1. **Canvas Change Event Handler**:
   ```typescript
   public onCanvasChange(event: any): void {
     const scale = event.scale || 1;
     this.currentZoomScale = scale;
     this.updateStrokeCompensation();
   }
   ```

2. **Stroke Compensation Logic**:
   ```typescript
   private updateStrokeCompensation(): void {
     // Calculate inversely proportional width
     const compensatedWidth = this.baseStrokeWidth / this.currentZoomScale;

     // Apply to all connection paths
     document.querySelectorAll('.f-connection-path').forEach((path: Element) => {
       (path as HTMLElement).style.strokeWidth = `${compensatedWidth}px`;
     });
   }
   ```

3. **Configuration**:
   - Base stroke width: 2px (defined in `baseStrokeWidth`)
   - Current zoom scale: Tracked in `currentZoomScale` signal
   - Target elements: All `.f-connection-path` SVG elements

#### How It Works

- When zoom scale = 1.0 (100%), stroke width = 2px
- When zoom scale = 0.5 (50% - zoomed out), stroke width = 4px (compensated)
- When zoom scale = 1.5 (150% - zoomed in), stroke width = 1.33px (compensated)

This ensures connection paths remain visible and consistent regardless of zoom level.

#### Auto-Update Mechanism

- Triggered automatically via `(fCanvasChange)` event on every zoom/pan operation
- Applied after initial layout completion (250ms + 100ms delay)
- No manual MutationObserver needed - uses Angular event binding

### ELK.js Configuration

#### Core Settings
- **Algorithm**: `'layered'` - Hierarchical layout for directed graphs
- **Direction**: `'RIGHT'` - Left-to-right flow
- **Graph structure**: Hierarchical (child nodes nested inside parent groups)
- **Hierarchy handling**: `'INCLUDE_CHILDREN'` - Properly handle nested structures

#### Spacing Configuration
**Root Level:**
- Node-to-node: 80px
- Between layers: 80px
- Between components: 100px
- Edge-to-node: 40px
- Edge-to-edge: 20px

**Within Groups:**
- Node-to-node: 50px
- Between layers: 50px
- Between components: 70px
- Padding: 50px on all sides

#### Layout Strategies
**Node Placement:**
- Strategy: `'NETWORK_SIMPLEX'` - Optimal node positioning minimizing edge length
- Crossing minimization: `'LAYER_SWEEP'` - Reduces edge crossings
- Cycle breaking: `'GREEDY'` - Handles cyclic dependencies
- Layering: `'NETWORK_SIMPLEX'` - Optimal layer assignment

#### Edge Routing
- Type: `'ORTHOGONAL'` - Right-angled edges for cleaner appearance
- Self-loop placement: `'NORTH_STACKED'` - Self-referencing edges on top
- Port constraints: `'FIXED_SIDE'` - Consistent connection sides

#### Advanced Features
- **Separate components**: Connected components are laid out separately
- **Model order**: Considers node/edge order for stability (`'NODES_AND_EDGES'`)
- **Interactive layout**: Optimized for incremental updates
- **Thoroughness**: Level 10 for high-quality layout (root level)
- **Auto-sizing**: Groups calculate size based on children

## Development Patterns

### Working with Signals

The application uses Angular signals for reactive state management:

```typescript
// Reading signal values
const groups = this.elkGroups();  // Call signal as function

// Setting signal values
this.elkGroups.set([...newGroups]);

// Updating signal values
this.elkNodes.update(nodes => [...nodes, newNode]);
```

**Template usage**:
```html
@for (group of elkGroups(); track $index) {
  <!-- group is the unwrapped value -->
}
```

Benefits:
- Fine-grained reactivity without Zone.js overhead
- Automatic change detection when signals update
- Better performance for large datasets
- Type-safe reactive state

### Using the Layout Service

The `ElkLayoutService` provides a clean API for performing graph layouts:

```typescript
// Basic usage (uses default options)
const result = await this.elkLayoutService.calculateLayout({
  groups: this.foblexGroups(),
  nodes: this.foblexNodes(),
  edges: this.foblexEdges(),
  enableGroups: true,
});

// Update UI with results
this.elkGroups.set(result.groups);
this.elkNodes.set(result.nodes);
this.elkEdges.set(result.edges);
```

#### Customizing Layout Options

Pass custom options as the second parameter:

```typescript
const result = await this.elkLayoutService.calculateLayout(
  {
    groups: this.foblexGroups(),
    nodes: this.foblexNodes(),
    edges: this.foblexEdges(),
    enableGroups: true,
  },
  {
    // Custom layout options
    algorithm: 'force',
    direction: 'DOWN',
    spacing: {
      nodeNode: 120,
      nodeNodeBetweenLayers: 150,
    },
    groupPadding: {
      top: 80,
      right: 80,
      bottom: 80,
      left: 80,
    },
    edgeRouting: 'SPLINES',
    nodePlacement: 'BRANDES_KOEPF',
  }
);
```

#### Available Layout Algorithms

```typescript
algorithm: 'layered'  // Best for hierarchical/flow diagrams (default)
algorithm: 'force'    // Force-directed layout
algorithm: 'stress'   // Stress-based layout
algorithm: 'mrtree'   // Tree layout
```

#### Layout Directions

```typescript
direction: 'RIGHT'  // Left-to-right (horizontal, default)
direction: 'DOWN'   // Top-to-bottom (vertical)
direction: 'UP'     // Bottom-to-top
direction: 'LEFT'   // Right-to-left
```

#### Node Placement Strategies

```typescript
nodePlacement: 'NETWORK_SIMPLEX'  // Optimal, straighter edges (default)
nodePlacement: 'BRANDES_KOEPF'    // Denser layouts
nodePlacement: 'LINEAR_SEGMENTS'  // Simpler/faster layout
```

#### Edge Routing Options

```typescript
edgeRouting: 'ORTHOGONAL'  // Right angles (default)
edgeRouting: 'POLYLINE'    // Straight segments
edgeRouting: 'SPLINES'     // Curved edges
```

#### Spacing Configuration

```typescript
spacing: {
  nodeNode: 80,                   // Space between adjacent nodes
  nodeNodeBetweenLayers: 80,      // Space between layers
  componentComponent: 100,         // Space between disconnected components
  edgeNode: 40,                    // Minimum edge-to-node distance
  edgeEdge: 20,                    // Minimum edge-to-edge distance
}
```

#### Group Padding

```typescript
groupPadding: {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50,
}
```

### Modifying Node/Group Generation

#### Enabling/Disabling Groups

Groups are optional and can be toggled with the `enableGroups` flag:

```typescript
// In app.component.ts
private enableGroups = true;  // Set to false to disable groups
private groupCount = 20;      // Number of groups when enabled
```

**With Groups Enabled** (`enableGroups = true`):
- Creates specified number of groups
- Each group gets 3-10 child nodes
- Additional root-level nodes created
- Hierarchical layout with group nesting

**With Groups Disabled** (`enableGroups = false`):
- Creates 50 root-level nodes only
- No hierarchical nesting
- Flat graph layout
- All edges at root level

#### Configuration Details

- Group dimensions: Start at 200x200 minimum, automatically expanded by ELK.js based on child nodes
- Group padding: 50px on all sides
- Node dimensions: random 100-350px width/height
- **Node assignment**: Each group gets its own dedicated nodes (parentId matches group)
- Node count per group: random 3-10 per group
- Root-level nodes: When groups enabled, additional nodes created with no parent

### Styling

- Component styles: `src/app/app.component.scss`
- Global styles: `src/app/common.scss`
- Style language: SCSS

## Configuration

- **Strict TypeScript**: Enabled with all strict flags
- **Component prefix**: `app`
- **Bundle budgets**: 500kB warning, 1MB error for initial bundle
- **SSR**: Configured with Angular Universal
