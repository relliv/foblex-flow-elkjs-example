import { Component, ViewChild } from '@angular/core';
import {
  EFResizeHandleType,
  FCanvasComponent,
  FFlowModule,
} from '@foblex/flow';
import { PointExtensions } from '@foblex/2d';

@Component({
  selector: 'app-root',
  imports: [FFlowModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  @ViewChild(FCanvasComponent, { static: true })
  public fCanvas!: FCanvasComponent;

  protected readonly eResizeHandleType = EFResizeHandleType;

  public onLoaded(): void {
    this.fCanvas.fitToScreen(PointExtensions.initialize(50, 50), false);
  }
}
