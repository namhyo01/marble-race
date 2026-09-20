import type { RenderParameters } from './rouletteRenderer';
import type { Rect } from './types/rect.type';
import type { UIObject } from './UIObject';

const MARGIN = 8;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 시계 패널이 차지하는 영역. 순위 패널이 이 아래에서 시작해야 하므로
 * RankRenderer도 같은 함수를 써서 겹치지 않게 맞춘다.
 */
export function getClockPanelRect(width: number, height: number): Rect {
  // 좁은 화면에서 패널이 화면을 다 먹지 않도록 너비와 높이 양쪽으로 제한한다
  const w = Math.max(132, Math.min(236, width * 0.26, height * 0.34));
  const h = w * 0.46;
  return { x: width - w - MARGIN, y: MARGIN, w, h };
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
  update(_deltaTime: number): void {}

  getBoundingBox(): Rect | null {
    return null;
  }

  render(ctx: CanvasRenderingContext2D, _params: RenderParameters, width: number, height: number): void {
    const { x, y, w, h } = getClockPanelRect(width, height);
    const radius = Math.max(6, w * 0.07);

    const now = new Date();
    const date = `${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now
      .getDate()
      .toString()
      .padStart(2, '0')} (${WEEKDAYS[now.getDay()]})`;
    const time = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 패널 바탕
    roundRect(ctx, x, y, w, h, radius);
    ctx.fillStyle = 'rgba(12, 12, 20, 0.82)';
    ctx.fill();

    const cx = x + w / 2;

    // 날짜는 시간 위에 작게
    const dateSize = Math.round(h * 0.2);
    ctx.font = `700 ${dateSize}px "Arial", sans-serif`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, dateSize * 0.3);
    ctx.strokeStyle = '#000';
    ctx.strokeText(date, cx, y + h * 0.29);
    ctx.fillStyle = '#9fe9ff';
    ctx.fillText(date, cx, y + h * 0.29);

    // 시간은 포스터 느낌으로: 굵은 검정 외곽선에 노랑에서 주황 그라데이션
    const timeSize = Math.round(h * 0.42);
    const timeY = y + h * 0.66;
    ctx.font = `900 ${timeSize}px "Arial Black", Arial, sans-serif`;

    const grad = ctx.createLinearGradient(0, timeY - timeSize / 2, 0, timeY + timeSize / 2);
    grad.addColorStop(0, '#fff3a6');
    grad.addColorStop(0.5, '#ffd028');
    grad.addColorStop(1, '#ff8a1e');

    ctx.lineWidth = Math.max(3, timeSize * 0.26);
    ctx.strokeStyle = '#000';
    ctx.strokeText(time, cx, timeY);
    ctx.fillStyle = grad;
    ctx.fillText(time, cx, timeY);

    // 테두리도 굵은 검정으로 둘러 포스터의 선 굵기를 맞춘다
    roundRect(ctx, x, y, w, h, radius);
    ctx.lineWidth = Math.max(3, w * 0.028);
    ctx.strokeStyle = '#000';
    ctx.stroke();

    ctx.restore();
  }
}
