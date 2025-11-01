import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LayoutConfig {
  enableGroups: boolean;
  algorithm: 'layered' | 'force' | 'stress' | 'mrtree';
  direction: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
  edgeRouting: 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
  nodePlacement: 'NETWORK_SIMPLEX' | 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS';
  nodeSpacing: number;
  layerSpacing: number;
  groupPadding: number;
}

@Component({
  selector: 'app-layout-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './layout-controls.component.html',
  styleUrl: './layout-controls.component.scss'
})
export class LayoutControlsComponent {
  @Input() config!: LayoutConfig;
  @Output() configChange = new EventEmitter<Partial<LayoutConfig>>();
  @Output() regenerateGraph = new EventEmitter<boolean>();

  // Options for dropdowns
  algorithmOptions = [
    { value: 'layered', label: 'Layered (Hierarchical)' },
    { value: 'force', label: 'Force-Directed (Organic)' },
    { value: 'stress', label: 'Stress (Minimized Edge Length)' },
    { value: 'mrtree', label: 'Tree (MR-Tree)' },
  ] as const;

  directionOptions = [
    { value: 'RIGHT', label: 'Left to Right' },
    { value: 'DOWN', label: 'Top to Bottom' },
    { value: 'LEFT', label: 'Right to Left' },
    { value: 'UP', label: 'Bottom to Top' },
  ] as const;

  edgeRoutingOptions = [
    { value: 'ORTHOGONAL', label: 'Orthogonal (90° angles)' },
    { value: 'POLYLINE', label: 'Polyline (straight segments)' },
    { value: 'SPLINES', label: 'Splines (curved)' },
  ] as const;

  nodePlacementOptions = [
    { value: 'NETWORK_SIMPLEX', label: 'Network Simplex' },
    { value: 'BRANDES_KOEPF', label: 'Brandes Koepf' },
    { value: 'LINEAR_SEGMENTS', label: 'Linear Segments' },
  ] as const;

  onEnableGroupsChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.regenerateGraph.emit(target.checked);
  }

  onAlgorithmChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const algorithm = target.value as 'layered' | 'force' | 'stress' | 'mrtree';
    this.configChange.emit({ algorithm });
  }

  onDirectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const direction = target.value as 'RIGHT' | 'DOWN' | 'LEFT' | 'UP';
    this.configChange.emit({ direction });
  }

  onEdgeRoutingChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const edgeRouting = target.value as 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
    this.configChange.emit({ edgeRouting });
  }

  onNodePlacementChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const nodePlacement = target.value as 'NETWORK_SIMPLEX' | 'BRANDES_KOEPF' | 'LINEAR_SEGMENTS';
    this.configChange.emit({ nodePlacement });
  }

  onNodeSpacingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const nodeSpacing = parseInt(target.value, 10);
    this.configChange.emit({ nodeSpacing });
  }

  onLayerSpacingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const layerSpacing = parseInt(target.value, 10);
    this.configChange.emit({ layerSpacing });
  }

  onGroupPaddingChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const groupPadding = parseInt(target.value, 10);
    this.configChange.emit({ groupPadding });
  }
}