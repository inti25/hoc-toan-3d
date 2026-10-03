import type { FloatingLabelPose, HudPresentationState, PresentationPresenterSeam } from './types';

export class HudPresenter implements PresentationPresenterSeam {
  private readonly PIXEL_THRESHOLD_SQ = 0.5 * 0.5; // 0.25 px^2

  private lastLocName?: string;
  private lastSubLabel?: string;
  private lastTravelText?: string;
  private lastInteractHtml?: string;
  private lastInteractHidden?: boolean;
  private lastPortalLabelHtml?: string;
  private lastBridgeLabelHidden?: boolean;
  private lastPortalLabelHidden?: boolean;
  private lastIsNearMilo?: boolean;
  private lastIsNearPortal?: boolean;

  private lastMiloPos?: { x: number; y: number };
  private lastBridgePos?: { x: number; y: number };
  private lastPortalPos?: { x: number; y: number };

  constructor(
    private readonly getEl: (id: string) => HTMLElement | null = (id) =>
      typeof document !== 'undefined' ? document.getElementById(id) : null
  ) {}

  reset(): void {
    this.lastLocName = undefined;
    this.lastSubLabel = undefined;
    this.lastTravelText = undefined;
    this.lastInteractHtml = undefined;
    this.lastInteractHidden = undefined;
    this.lastPortalLabelHtml = undefined;
    this.lastBridgeLabelHidden = undefined;
    this.lastPortalLabelHidden = undefined;
    this.lastIsNearMilo = undefined;
    this.lastIsNearPortal = undefined;
    this.lastMiloPos = undefined;
    this.lastBridgePos = undefined;
    this.lastPortalPos = undefined;
  }

  render(state: HudPresentationState): void {
    // 1. Text & Subtitle updates (only on change)
    if (state.locName !== this.lastLocName) {
      this.lastLocName = state.locName;
      const elStatus = this.getEl('village-status-text');
      if (elStatus) elStatus.textContent = state.locName;
      const elArea = this.getEl('area-label-text');
      if (elArea) elArea.textContent = state.locName;
    }

    if (state.subLabel !== this.lastSubLabel) {
      this.lastSubLabel = state.subLabel;
      const elSub = this.getEl('area-label-sub');
      if (elSub) elSub.textContent = state.subLabel;
    }

    if (state.travelText !== this.lastTravelText) {
      this.lastTravelText = state.travelText;
      const elTravel = this.getEl('travel-text');
      if (elTravel) elTravel.textContent = state.travelText;
    }

    // 2. Interact banner (only on change)
    if (state.interactHtml !== this.lastInteractHtml) {
      this.lastInteractHtml = state.interactHtml;
      const elInteract = this.getEl('interact');
      if (elInteract) elInteract.innerHTML = state.interactHtml;
    }

    if (state.interactHidden !== this.lastInteractHidden) {
      this.lastInteractHidden = state.interactHidden;
      const elInteract = this.getEl('interact');
      if (elInteract) elInteract.hidden = state.interactHidden;
    }

    // 3. Proximity CSS classes
    if (state.isNearMilo !== this.lastIsNearMilo) {
      this.lastIsNearMilo = state.isNearMilo;
      const elMilo = this.getEl('milo-label');
      elMilo?.classList.toggle('near', state.isNearMilo);
    }

    if (state.isNearPortal !== this.lastIsNearPortal) {
      this.lastIsNearPortal = state.isNearPortal;
      const elPortal = this.getEl('portal-label');
      elPortal?.classList.toggle('near', state.isNearPortal);
    }

    // 4. Portal label content
    if (state.portalLabelHtml !== undefined && state.portalLabelHtml !== this.lastPortalLabelHtml) {
      this.lastPortalLabelHtml = state.portalLabelHtml;
      const elPortal = this.getEl('portal-label');
      if (elPortal) elPortal.innerHTML = state.portalLabelHtml;
    }

    // 5. Visibility toggles
    if (state.bridgeLabelHidden !== undefined && state.bridgeLabelHidden !== this.lastBridgeLabelHidden) {
      this.lastBridgeLabelHidden = state.bridgeLabelHidden;
      const elBridge = this.getEl('bridge-label');
      if (elBridge) elBridge.hidden = state.bridgeLabelHidden;
    }

    if (state.portalLabelHidden !== undefined && state.portalLabelHidden !== this.lastPortalLabelHidden) {
      this.lastPortalLabelHidden = state.portalLabelHidden;
      const elPortal = this.getEl('portal-label');
      if (elPortal) elPortal.hidden = state.portalLabelHidden;
    }

    // 6. Floating 3D label transforms (threshold checked >= 0.5px)
    if (state.miloPose && this.shouldUpdatePose(state.miloPose, this.lastMiloPos)) {
      this.lastMiloPos = { x: state.miloPose.x, y: state.miloPose.y };
      const elMilo = this.getEl('milo-label');
      if (elMilo) {
        elMilo.style.transform = `translate(${state.miloPose.x}px,${state.miloPose.y}px) translate(-50%,-100%)`;
      }
    }

    if (state.bridgePose && this.shouldUpdatePose(state.bridgePose, this.lastBridgePos)) {
      this.lastBridgePos = { x: state.bridgePose.x, y: state.bridgePose.y };
      const elBridge = this.getEl('bridge-label');
      if (elBridge) {
        elBridge.style.transform = `translate(${state.bridgePose.x}px,${state.bridgePose.y}px) translate(-50%,15px)`;
      }
    }

    if (state.portalPose && this.shouldUpdatePose(state.portalPose, this.lastPortalPos)) {
      this.lastPortalPos = { x: state.portalPose.x, y: state.portalPose.y };
      const elPortal = this.getEl('portal-label');
      if (elPortal) {
        elPortal.style.transform = `translate(${state.portalPose.x}px,${state.portalPose.y}px) translate(-50%,-100%)`;
      }
    }
  }

  private shouldUpdatePose(
    current: FloatingLabelPose,
    last?: { x: number; y: number }
  ): boolean {
    if (!last) return true;
    const dx = current.x - last.x;
    const dy = current.y - last.y;
    return dx * dx + dy * dy >= this.PIXEL_THRESHOLD_SQ;
  }
}
