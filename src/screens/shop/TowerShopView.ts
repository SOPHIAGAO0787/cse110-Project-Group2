import Konva from "konva";
import { makeButton } from "../button";
import type { ShopTower } from "./shopPreviewData";

interface ShopViewState {
  towers: ShopTower[];
  selectedId: string;
  levels: ReadonlyMap<string, number>;
  coins: number;
}

interface ShopCallbacks {
  onSelect: (id: string) => void;
  onAction: () => void;
  onBack: () => void;
}

//place holder : could be changed on our team's size
const WIDTH = 900;
const HEIGHT = 640;

export class TowerShopView {
  group = new Konva.Group();

  private scene = new Konva.Group();
  private content = new Konva.Group();
  private popup = new Konva.Group({ visible: false });

  constructor(private callbacks: ShopCallbacks) {
    this.scene.add(this.content, this.popup);
    this.group.add(this.scene);
  }
}