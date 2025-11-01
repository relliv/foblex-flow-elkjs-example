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

### Core Flow

The application follows this data flow pattern:

1. **Initial Data Generation** (ngOnInit):
   - Creates random groups using Faker.js
   - Generates nodes with random dimensions and optional parent group assignments
   - Creates random edges connecting nodes

2. **Layout Calculation** (elkLayout):
   - Converts Foblex data structures to ELK.js hierarchical graph format
   - Child nodes are nested inside their parent groups (not a flat list)
   - Groups are passed without width/height - ELK.js calculates sizes based on children
   - ELK.js computes positions using layered algorithm with 50px padding
   - Results are flattened back to Foblex format (child positions relative to parent)
   - Canvas auto-fits to display all content

3. **Rendering**:
   - Template conditionally renders nodes inside their parent groups
   - Nodes without parents render at root level
   - Edges connect nodes via input/output handles

### Key Interfaces

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
```

### Component Structure

**AppComponent** (`src/app/app.component.ts`):
- Single-component architecture using Angular signals
- **Reactive state with signals**:
  - `foblexGroups/Nodes/Edges` - Signals holding initial random data
  - `elkGroups/Nodes/Edges` - Signals holding layout-calculated positions
  - All updates use `.set()` or `.update()` methods
  - Template reads signal values with `()`  syntax (e.g., `elkGroups()`)
- Key methods:
  - `createGroups()` - Generates random groups and their child nodes (sizes calculated by ELK)
  - `createNodesForGroup()` - Creates 3-10 nodes for a specific group (or root level if null)
  - `createRandomWiredEdges()` - Generates random connections
  - `elkLayout()` - Executes ELK layout algorithm (groups auto-sized based on children)
  - `onLoaded()` - Triggers layout after canvas initialization

### Template Architecture

The template (`src/app/app.component.html`) uses nested @for loops:
1. Iterates over `elkGroups` to render group containers
2. Inside each group, iterates `elkNodes` filtering by `parentId`
3. Separately renders root-level nodes (where `parentId === null`)
4. Renders all edges with fixed center behavior

### Foblex Flow Integration

- **Canvas**: `<f-canvas>` with zoom support (step: 0.045)
- **Groups**: `fGroup` directive with drag handles
- **Nodes**: `fNode` directive with position/size binding
- **Handles**: `fNodeInput` (left) and `fNodeOutput` (right) for connections
- **Connections**: `f-connection` with segment type and fixed center behavior
- **Background**: Circle pattern overlay

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

### Customizing ELK Layout Options

#### Changing Layout Direction
```typescript
'elk.direction': 'DOWN'  // Top-to-bottom (vertical)
'elk.direction': 'RIGHT' // Left-to-right (horizontal, default)
'elk.direction': 'UP'    // Bottom-to-top
'elk.direction': 'LEFT'  // Right-to-left
```

#### Adjusting Spacing
```typescript
// Increase spacing between nodes
'elk.spacing.nodeNode': '100',

// Increase spacing between layers
'elk.layered.spacing.nodeNodeBetweenLayers': '120',

// Add more space around groups
'elk.padding': '[top=80,left=80,bottom=80,right=80]',
```

#### Trying Different Algorithms
```typescript
'elk.algorithm': 'layered'  // Best for hierarchical/flow diagrams (default)
'elk.algorithm': 'force'    // Force-directed layout
'elk.algorithm': 'stress'   // Stress-based layout
'elk.algorithm': 'mrtree'   // Tree layout
```

#### Changing Node Placement Strategy
```typescript
// For denser layouts
'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',

// For straighter edges (default)
'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',

// For simpler/faster layout
'elk.layered.nodePlacement.strategy': 'LINEAR_SEGMENTS',
```

#### Edge Routing Options
```typescript
'elk.edgeRouting': 'ORTHOGONAL'  // Right angles (default)
'elk.edgeRouting': 'POLYLINE'    // Straight segments
'elk.edgeRouting': 'SPLINES'     // Curved edges
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
