export interface FloatingLabelPose {
  x: number;
  y: number;
  visible: boolean;
}

export interface HudPresentationState {
  locName: string;
  subLabel: string;
  travelText: string;
  interactHtml: string;
  interactHidden: boolean;
  isNearMilo: boolean;
  isNearPortal: boolean;
  miloPose?: FloatingLabelPose;
  bridgePose?: FloatingLabelPose;
  portalPose?: FloatingLabelPose;
  portalLabelHtml?: string;
  bridgeLabelHidden?: boolean;
  portalLabelHidden?: boolean;
}

export interface PresentationPresenterSeam {
  /** Updates the DOM only when properties have changed beyond threshold */
  render(state: HudPresentationState): void;
  /** Resets memoized caches (useful on scene changes or reset) */
  reset(): void;
}
