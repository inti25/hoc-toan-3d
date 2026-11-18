export interface FloatingLabelPose {
  x: number;
  y: number;
  visible: boolean;
}

export interface PortalSummary {
  id: string;
  name: string;
  requiresSelection?: boolean;
  source?: { x: number; z: number };
  target?: { x: number; z: number };
  targetRegionId?: string;
}

export interface WorldFrameSnapshot {
  active: boolean;
  paused: boolean;
  fps: number;
  playerPosition: { x: number; z: number };
  locationName: string;
  inGarden: boolean;
  inArchimedes: boolean;
  nearMilo: boolean;
  crossedRiver: boolean;
  nearFlowerIndex: number;
  nearMonolithIndex: number;
  nearParkTreeIndex: number;
  nearShop: boolean;
  nearFarmAnimalId: string | null;
  nearPortal: PortalSummary | null;
  portalTransit: PortalSummary | null;
  hudPoses?: {
    miloPose: FloatingLabelPose;
    bridgePose: FloatingLabelPose;
    portalPose: FloatingLabelPose;
  };
}

export interface HudSnapshotContext {
  subLabel: string;
  interactTargetLabel?: {
    html: string;
    visible: boolean;
  };
  arrowHtml: string;
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
  /** Formats and renders a WorldFrameSnapshot emitted by World */
  renderSnapshot(snapshot: WorldFrameSnapshot, context: HudSnapshotContext): void;
  /** Resets memoized caches (useful on scene changes or reset) */
  reset(): void;
}
