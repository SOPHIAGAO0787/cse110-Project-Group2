import type { TowerConfig, Vec } from "./types";

type PlacementState =
  //StateMachine tracking what process of placement user is in
  | { kind: "idle" } // nothing being placed
  | { kind: "dragging"; pos: Vec } // ghost following the pointer
  | { kind: "placed"; pos: Vec } // ghost dropped, waiting to confirm
  | { kind: "configuring"; pos: Vec; config: TowerConfig }; // dropped, player is still adjusting (e.g. aiming a triangle)

export class PlacementModel {
  state: PlacementState = { kind: "idle" };

  startDrag(pos: Vec) {
    this.state = { kind: "dragging", pos };
  }

  endDrag(pos: Vec, valid: boolean) {
    if (this.state.kind !== "dragging") return;
    this.state = valid ? { kind: "placed", pos } : { kind: "idle" };
  }

  // Starts or updates the adjusting step for a dropped tower. Ignored unless one is dropped.
  configure(config: TowerConfig) {
    if (this.state.kind !== "placed" && this.state.kind !== "configuring") return;
    this.state = { kind: "configuring", pos: this.state.pos, config };
  }

  confirm(): Vec | null {
    if (this.state.kind !== "placed" && this.state.kind !== "configuring") return null;
    const pos = this.state.pos;
    this.state = { kind: "idle" };
    return pos;
  }

  cancel() {
    this.state = { kind: "idle" };
  }
}
