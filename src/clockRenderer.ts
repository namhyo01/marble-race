import type { RenderParameters } from './rouletteRenderer';
import type { Rect } from './types/rect.type';
import type { UIObject } from './UIObject';

const MARGIN = 8;
const IMAGE_URL = new URL('../assets/images/coinranger.webp', import.meta.url);

/**
 * 시계 패널이 차지하는 영역. 순위 패널이 이 아래에서 시작해야 하므로
 * RankRenderer도 같은 함수를 써서 겹치지 않게 맞춘다.
 */
export function getClockPanelRect(width: number, height: number): Rect {
  // 좁은 화면에서 패널이 화면을 다 먹지 않도록 너비와 높이 양쪽으로 제한한다
  const w = Math.max(96, Math.min(190, width * 0.2, height * 0.3));
  const barH = Math.max(22, w * 0.2);
  return { x: width - w - MARGIN, y: MARGIN, w, h: w + barH };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class ClockRenderer implements UIObject {
  private _image: HTMLImageElement | null = null;

  constructor() {
    const img = new Image();
    img.onload = () => {
      this._image = img;
    };
    img.src = IMAGE_URL.toString();
  }

  update(_deltaTime: number): void {}

  getBoundingBox(): Rect | null {
    return null;
  }

  render(ctx: CanvasRenderingContext2D, _params: RenderParameters, width: number, height: number): void {
    const { x, y, w, h } = getClockPanelRect(width, height);
    const barH = h - w;
    const radius = Math.max(6, w * 0.08);

    // clip을 쓰므로 반드시 save/restore로 감싼다. clip은 restore 말고는 해제되지 않아
    // 한 번 새어 나가면 이후 렌더링이 전부 이 패널 안으로 잘린다.
    ctx.save();

    // 패널 바탕. 이미지가 아직 안 왔을 때도 자리가 비어 보이지 않게 먼저 깐다
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = '#111';
    ctx.fill();

    // 이미지는 정사각형이라 패널 윗부분에 그대로 넣는다
    if (this._image) {
      ctx.save();
      roundRect(ctx, x, y, w, w, radius);
      ctx.clip();
      ctx.drawImage(this._image, x, y, w, w);
      ctx.restore();
    }

    // 시간 바
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.fillStyle = '#12121a';
    ctx.fillRect(x, y + w, w, barH);
    ctx.restore();

    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const ss = now.getSeconds().toString().padStart(2, '0');
    const text = `${hh}:${mm}:${ss}`;

    const fontSize = Math.round(barH * 0.62);
    ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = x + w / 2;
    const cy = y + w + barH / 2 + 1;

    // 포스터 느낌: 굵은 검정 외곽선에 노랑→주황 그라데이션
    const grad = ctx.createLinearGradient(0, cy - fontSize / 2, 0, cy + fontSize / 2);
    grad.addColorStop(0, '#fff3a6');
    grad.addColorStop(0.5, '#ffd028');
    grad.addColorStop(1, '#ff8a1e');

    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, fontSize * 0.28);
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, cx, cy);
    ctx.fillStyle = grad;
    ctx.fillText(text, cx, cy);

    // 패널 테두리도 굵은 검정으로 둘러 포스터의 선 굵기를 맞춘다
    roundRect(ctx, x, y, w, h, radius);
    ctx.lineWidth = Math.max(3, w * 0.035);
    ctx.strokeStyle = '#000';
    ctx.stroke();

    ctx.restore();
  }
}
