import type { Vec } from "../model/types";

type PlacementState =                       //StateMachine tracking what process of placement user is in
  | { kind: "idle" }                        // nothing being placed
  | { kind: "dragging"; pos: Vec | null }  // ghost following the pointer
  | { kind: "placed"; pos: Vec };          // ghost dropped, waiting to confirm

export class PlacementModel {
  state: PlacementState = { kind: "idle" };

  startDrag(pos: Vec) {
    this.state = { kind: "dragging", pos};
  }

  endDrag(pos: Vec, valid: boolean) {
    if (this.state.kind !== "dragging") return;
    this.state = valid ? { kind: "placed", pos } : { kind: "idle" };
  }

  confirm(): Vec | null {
    if (this.state.kind !== "placed") return null;
    const pos = this.state.pos;
    this.state = { kind: "idle" };
    return pos;
  }

  cancel() {
    this.state = { kind: "idle" };
  }
}