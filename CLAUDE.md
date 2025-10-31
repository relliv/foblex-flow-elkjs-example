# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a proof of concept Angular application demonstrating the integration of Foblex Flow with ELK.js (Eclipse Layout Kernel) for automatic graph layout with group support. The project showcases hierarchical node-based flow diagrams with automatic layout capabilities.

## Technology Stack

- **Angular 19** - Modern Angular with standalone components
- **Foblex Flow** - Flow diagram library for node-based UIs
- **ELK.js** - Automatic graph layout engine (layered algorithm)
- **pnpm** - Package manager (version 9.15.9+)
- **TypeScript 5.7** - Strict mode enabled

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
- Single-component architecture
- Manages two sets of data:
  - `foblexGroups/Nodes/Edges` - Initial random data
  - `elkGroups/Nodes/Edges` - Layout-calculated positions
- Key methods:
  - `createGroups()` - Generates random groups (sizes calculated by ELK)
  - `createNodes()` - Creates nodes with random dimensions and 50% chance of group assignment
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

- Algorithm: `'layered'` - Hierarchical layout for directed graphs
- Node types: Distinguished as 'group' or 'node' for proper hierarchy
- **Graph structure**: Hierarchical (child nodes nested inside parent groups, not flat with `parentId`)
- Group sizing: Groups do not specify width/height, allowing ELK to calculate based on children
- Padding: Groups have 50px padding on all sides for visual spacing
- **Child positioning**: Node positions inside groups are relative to the group's origin

## Development Patterns

### Adding New Layout Options

To customize ELK layout behavior, modify the `layoutOptions` in `elkLayout()`:
```typescript
layoutOptions: {
  'elk.algorithm': 'layered',
  // Add additional ELK options here
}
```

### Modifying Node/Group Generation

- Group dimensions: Start at 200x200 minimum, automatically expanded by ELK.js based on child nodes
- Group padding: `src/app/app.component.ts:97` (currently 50px on all sides)
- Node dimensions: `src/app/app.component.ts:206-207` (random 100-350px)
- Group assignment probability: `src/app/app.component.ts:198` (currently 50%)
- Node count per group: `src/app/app.component.ts:191` (random up to 20)

### Styling

- Component styles: `src/app/app.component.scss`
- Global styles: `src/app/common.scss`
- Style language: SCSS

## Configuration

- **Strict TypeScript**: Enabled with all strict flags
- **Component prefix**: `app`
- **Bundle budgets**: 500kB warning, 1MB error for initial bundle
- **SSR**: Configured with Angular Universal
