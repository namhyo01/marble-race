import {
  type AdOverlayMode,
  type AdOverlayState,
  type AdRect,
  closeButtonSize,
  drawAdOverlay,
  drawCloseCircle,
} from './adRenderer';
import type { Camera } from './camera';
import { canvasHeight, canvasWidth, initialZoom, Themes, winnerAreaHeight } from './data/constants';
import type { StageDef } from './data/maps';
import type { GameObject } from './gameObject';
import { KeywordService } from './keywordService';
import type { Marble } from './marble';
import { MINIMAP_INSET, MINIMAP_WIDTH } from './minimap';
import type { WinnerRange } from './options';
import type { ParticleManager } from './particleManager';
import type { RoundAd } from './types/Ad.type';
import type { ColorTheme } from './types/ColorTheme';
import type { MapEntityState } from './types/MapEntity.type';
import type { VectorLike } from './types/VectorLike';
import type { UIObject } from './UIObject';

export type RenderParameters = {
  camera: Camera;
  stage: StageDef;
  entities: MapEntityState[];
  marbles: Marble[];
  winners: Marble[];
  particleManager: ParticleManager;
  effects: GameObject[];
  winnerRange: WinnerRange;
  /** 진행 중에는 null, 당첨자가 모두 확정되면 당첨자 배열 */
  result: Marble[] | null;
  size: VectorLike;
  theme: ColorTheme;
};

const MAX_DISPLAY_WIDTH = 1920;
const WINNER_TEXT_OFFSET = 30;
const RESULT_PANEL_MAX_WIDTH_RATIO = 0.9;
const RESULT_PANEL_MAX_HEIGHT_RATIO = 0.8;
const RESULT_COLUMN_MAX_WIDTH = 280;
const PROGRESS_MAX_WIDTH_RATIO = 0.3;
const PROGRESS_ACCENT = 'rgba(255, 215, 0, 0.8)';

export type AdHit = { type: 'close' } | { type: 'link'; url: string };

function inRect(rect: AdRect | undefined, x: number, y: number): boolean {
  return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export class RouletteRenderer {
  protected _canvas!: HTMLCanvasElement;
  protected _sceneCanvas!: HTMLCanvasElement;
  protected ctx!: CanvasRenderingContext2D;
  private _displayCtx!: CanvasRenderingContext2D;
  public sizeFactor = 1;

  protected _images: { [key: string]: HTMLImageElement } = {};
  private _backgroundImage: HTMLImageElement | null = null;
  private _backgroundCache: HTMLCanvasElement | null = null;
  private _backgroundCacheKey = '';
  protected _theme: ColorTheme = Themes.dark;
  private _ad: RoundAd | null = null;
  private _adImageCache: Map<string, HTMLImageElement> = new Map();
  private _adOverlay: AdOverlayState | null = null;
  private _resultCloseRect: AdRect | null = null;
  private _resultPopupClosed = false;
  private _lastResult: Marble[] | null = null;
  protected _keywordService: KeywordService;

  constructor() {
    this._keywordService = this.createKeywordService();
  }

  protected createKeywordService(): KeywordService {
    return new KeywordService();
  }

  get width() {
    return this._sceneCanvas.width;
  }

  get height() {
    return this._sceneCanvas.height;
  }

  get canvas() {
    return this._canvas;
  }

  set theme(value: ColorTheme) {
    this._theme = value;
  }

  async init() {
    await Promise.all([this._load(), this._keywordService.init()]);

    this._canvas = document.createElement('canvas');
    this._canvas.width = canvasWidth;
    this._canvas.height = canvasHeight;
    this._displayCtx = this._canvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;

    this._sceneCanvas = document.createElement('canvas');
    this._sceneCanvas.width = canvasWidth;
    this._sceneCanvas.height = canvasHeight;
    this.ctx = this._sceneCanvas.getContext('2d', {
      alpha: false,
    }) as CanvasRenderingContext2D;

    document.body.appendChild(this._canvas);

    const resizing = (entries?: ResizeObserverEntry[]) => {
      const realSize = entries ? entries[0].contentRect : this._canvas.getBoundingClientRect();
      if (realSize.width <= 0 || realSize.height <= 0) return;

      const width = Math.max(realSize.width / 2, 640);
      const height = (width / realSize.width) * realSize.height;
      this._sceneCanvas.width = width;
      this._sceneCanvas.height = height;
      this.sizeFactor = width / realSize.width;

      const displayWidth = Math.min(realSize.width, MAX_DISPLAY_WIDTH);
      this._canvas.width = displayWidth;
      this._canvas.height = (displayWidth / realSize.width) * realSize.height;
    };

    const resizeObserver = new ResizeObserver(resizing);

    resizeObserver.observe(this._canvas);
    resizing();
  }

  private async _loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((rs) => {
      const img = new Image();
      img.addEventListener('load', () => {
        rs(img);
      });
      img.src = url;
    });
  }

  private async _load(): Promise<void> {
    // 구슬 이름이 여기 키와 정확히 일치하면 그 이미지를 구슬 스킨으로 쓴다.
    // 경로는 Parcel이 정적으로 분석하므로 변수로 만들면 번들에 포함되지 않는다.
    // 반드시 리터럴로 적을 것.
    const loadPromises = [
      { name: 'AAVE', imgUrl: new URL('../assets/images/coins/AAVE.png', import.meta.url) },
      { name: 'ADA', imgUrl: new URL('../assets/images/coins/ADA.png', import.meta.url) },
      { name: 'AVAX', imgUrl: new URL('../assets/images/coins/AVAX.png', import.meta.url) },
      { name: 'BCH', imgUrl: new URL('../assets/images/coins/BCH.png', import.meta.url) },
      { name: 'BNB', imgUrl: new URL('../assets/images/coins/BNB.png', import.meta.url) },
      { name: 'BTC', imgUrl: new URL('../assets/images/coins/BTC.png', import.meta.url) },
      { name: 'DOGE', imgUrl: new URL('../assets/images/coins/DOGE.png', import.meta.url) },
      { name: 'DOT', imgUrl: new URL('../assets/images/coins/DOT.jpg', import.meta.url) },
      { name: 'ENA', imgUrl: new URL('../assets/images/coins/ENA.png', import.meta.url) },
      { name: 'ETC', imgUrl: new URL('../assets/images/coins/ETC.png', import.meta.url) },
      { name: 'ETH', imgUrl: new URL('../assets/images/coins/ETH.png', import.meta.url) },
      { name: 'GRAM', imgUrl: new URL('../assets/images/coins/GRAM.png', import.meta.url) },
      { name: 'HBAR', imgUrl: new URL('../assets/images/coins/HBAR.png', import.meta.url) },
      { name: 'ICP', imgUrl: new URL('../assets/images/coins/ICP.png', import.meta.url) },
      { name: 'LINK', imgUrl: new URL('../assets/images/coins/LINK.png', import.meta.url) },
      { name: 'LTC', imgUrl: new URL('../assets/images/coins/LTC.png', import.meta.url) },
      { name: 'NEAR', imgUrl: new URL('../assets/images/coins/NEAR.jpg', import.meta.url) },
      { name: 'ONDO', imgUrl: new URL('../assets/images/coins/ONDO.png', import.meta.url) },
      { name: 'PAXG', imgUrl: new URL('../assets/images/coins/PAXG.png', import.meta.url) },
      { name: 'PUMP', imgUrl: new URL('../assets/images/coins/PUMP.jpg', import.meta.url) },
      { name: 'SKY', imgUrl: new URL('../assets/images/coins/SKY.jpg', import.meta.url) },
      { name: 'SOL', imgUrl: new URL('../assets/images/coins/SOL.png', import.meta.url) },
      { name: 'SUI', imgUrl: new URL('../assets/images/coins/SUI.png', import.meta.url) },
      { name: 'TAO', imgUrl: new URL('../assets/images/coins/TAO.jpeg', import.meta.url) },
      { name: 'UNI', imgUrl: new URL('../assets/images/coins/UNI.png', import.meta.url) },
      { name: 'WLD', imgUrl: new URL('../assets/images/coins/WLD.jpeg', import.meta.url) },
      { name: 'WLFI', imgUrl: new URL('../assets/images/coins/WLFI.png', import.meta.url) },
      { name: 'XLM', imgUrl: new URL('../assets/images/coins/XLM.jpg', import.meta.url) },
      { name: 'XRP', imgUrl: new URL('../assets/images/coins/XRP.png', import.meta.url) },
      { name: 'ZEC', imgUrl: new URL('../assets/images/coins/ZEC.png', import.meta.url) },
    ].map(({ name, imgUrl }) => {
      return (async () => {
        this._images[name] = await this._loadImage(imgUrl.toString());
      })();
    });

    loadPromises.push(
      (async () => {
        await this._loadImage(new URL('../assets/images/ff.svg', import.meta.url).toString());
      })()
    );

    loadPromises.push(
      (async () => {
        this._backgroundImage = await this._loadImage(
          new URL('../assets/images/coinranger.webp', import.meta.url).toString()
        );
      })()
    );

    await Promise.all(loadPromises);
  }

  private getMarbleImage(name: string): CanvasImageSource | undefined {
    // Priority 1: Hardcoded images
    if (this._images[name]) {
      return this._images[name];
    }
    // Priority 2: Keyword sprites from API
    return this._keywordService.getSprite(name);
  }

  protected onBeforeEntities(): void {}
  protected onAfterScene(): void {}

  setAd(ad: RoundAd | null): void {
    this._ad = ad;
    if (!ad) return;
    this.preloadAdImages([...Object.values(ad.creatives), ad.qrImage]);
  }

  /** 소재를 미리 받아둔다. 여기서 만든 엘리먼트를 나중에 그대로 그리므로 캐시 헤더와 무관하게 즉시 뜬다 */
  preloadAdImages(srcs: (string | undefined)[]): void {
    for (const src of srcs) {
      if (src) this.cacheAdImage(src);
    }
  }

  private adImage(src?: string): HTMLImageElement | undefined {
    return src ? this._adImageCache.get(src) : undefined;
  }

  private cacheAdImage(src: string): HTMLImageElement {
    const cached = this._adImageCache.get(src);
    if (cached) return cached;
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.src = src;
    this._adImageCache.set(src, el);
    return el;
  }

  showAdOverlay(mode: AdOverlayMode): void {
    if (!this._ad || !this._ad.slots?.includes(mode)) return;
    this._adOverlay = { mode, ad: this._ad, since: performance.now(), endingSince: undefined };
  }

  getAdHitAt(x: number, y: number): AdHit | null {
    const overlay = this._adOverlay;
    if (!overlay || overlay.endingSince !== undefined) return null;

    if (inRect(overlay.closeRect, x, y)) return { type: 'close' };

    const link = overlay.ad.linkUrl;
    if (link && inRect(overlay.clickRect, x, y)) return { type: 'link', url: link };

    return null;
  }

  hideAdOverlay(): void {
    if (this._adOverlay && this._adOverlay.endingSince === undefined) {
      this._adOverlay.endingSince = performance.now();
    }
  }

  private renderAdOverlay(renderParameters: RenderParameters): void {
    const overlay = this._adOverlay;
    if (!overlay) return;

    if (overlay.mode === 'result' && !renderParameters.result) {
      this.hideAdOverlay();
    }

    const scale = this._canvas.width / this._sceneCanvas.width;
    try {
      this._displayCtx.save();
      this._displayCtx.scale(scale, scale);
      const alive = drawAdOverlay(this._displayCtx, this._sceneCanvas.width, this._sceneCanvas.height, overlay, {
        preroll: this.adImage(overlay.ad.creatives.preroll),
        result: this.adImage(overlay.ad.creatives.result),
        qr: this.adImage(overlay.ad.qrImage),
      });
      this._displayCtx.restore();
      if (!alive) this._adOverlay = null;
    } catch (e) {
      this._displayCtx.restore();
      console.error('[ads] 오버레이 렌더링 실패, 이번 노출은 건너뜁니다', e);
      this._adOverlay = null;
    }
  }

  private renderAdBoards(stage: StageDef): void {
    const ad = this._ad;
    if (!ad || !ad.slots?.includes('goal') || !stage.adBoards?.length) return;

    const img = this.adImage(ad.creatives.goal);
    if (!img?.complete || img.naturalWidth === 0) return;

    try {
      this.ctx.save();
      for (const board of stage.adBoards) {
        const w = board.w ?? 4;
        const h = board.h ?? 1;
        const x = board.x - w / 2;
        const y = board.y - h / 2;
        this.ctx.drawImage(img, x, y, w, h);
      }
    } catch (e) {
      console.error('[ads] 광고판 렌더링 실패, 이번 게재는 건너뜁니다', e);
      this._ad = null;
    } finally {
      this.ctx.restore();
    }
  }

  render(renderParameters: RenderParameters, uiObjects: UIObject[]) {
    this._theme = renderParameters.theme;
    this.ctx.fillStyle = this._theme.background;
    this.ctx.fillRect(0, 0, this._sceneCanvas.width, this._sceneCanvas.height);
    this.renderBackgroundImage();

    this.ctx.save();
    this.ctx.scale(initialZoom, initialZoom);
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.font = '0.4pt sans-serif';
    this.ctx.lineWidth = 3 / (renderParameters.camera.zoom + initialZoom);
    renderParameters.camera.renderScene(this.ctx, () => {
      this.renderAdBoards(renderParameters.stage);
      this.onBeforeEntities();
      this.renderEntities(renderParameters.entities);
      this.renderEffects(renderParameters);
      this.renderMarbles(renderParameters);
    });
    this.ctx.restore();
    this.onAfterScene();

    uiObjects.forEach((obj) =>
      obj.render(this.ctx, renderParameters, this._sceneCanvas.width, this._sceneCanvas.height)
    );
    renderParameters.particleManager.render(this.ctx);
    this.renderWinnerProgress(renderParameters);
    this.renderResult(renderParameters);

    this._displayCtx.drawImage(this._sceneCanvas, 0, 0, this._canvas.width, this._canvas.height);
    this.renderAdOverlay(renderParameters);
  }

  /**
   * 배경 이미지를 화면에 꽉 차게(cover) 깐다. 선명하게 깔면 맵 선과 구슬이
   * 묻히므로 흐리게 처리해 뒤로 물리고, 위에 어두운 막을 덮어 대비를 만든다.
   *
   * blur 필터는 매 프레임 돌리기엔 비싸다. 화면 크기가 바뀔 때만 오프스크린
   * 캔버스에 한 번 그려 두고, 그 뒤로는 그것만 복사한다.
   */
  private renderBackgroundImage(): void {
    const img = this._backgroundImage;
    if (!img) return;

    const cw = this._sceneCanvas.width;
    const ch = this._sceneCanvas.height;
    if (cw === 0 || ch === 0) return;

    const key = `${cw}x${ch}`;
    if (!this._backgroundCache || this._backgroundCacheKey !== key) {
      const cache = document.createElement('canvas');
      cache.width = cw;
      cache.height = ch;
      const cacheCtx = cache.getContext('2d');
      if (!cacheCtx) return;

      // blur는 가장자리를 투명하게 만든다. 조금 크게 그려 여백이 생기지 않게 한다
      const scale = Math.max(cw / img.width, ch / img.height) * 1.15;
      const dw = img.width * scale;
      const dh = img.height * scale;
      cacheCtx.filter = 'blur(12px)';
      cacheCtx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);

      this._backgroundCache = cache;
      this._backgroundCacheKey = key;
    }

    this.ctx.save();
    this.ctx.globalAlpha = 0.34;
    this.ctx.drawImage(this._backgroundCache, 0, 0);
    this.ctx.restore();

    // 막은 테마 배경색으로 덮는다. 다크에서는 어둡게, 라이트에서는 밝게 눌려
    // 어느 쪽에서도 배경이 겉돌지 않는다
    this.ctx.save();
    this.ctx.globalAlpha = 0.42;
    this.ctx.fillStyle = this._theme.background;
    this.ctx.fillRect(0, 0, cw, ch);
    this.ctx.restore();
  }

  private renderEntities(entities: MapEntityState[]) {
    this.ctx.save();
    entities.forEach((entity) => {
      const transform = this.ctx.getTransform();
      this.ctx.translate(entity.x, entity.y);
      this.ctx.rotate(entity.angle);
      this.ctx.fillStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].fill;
      this.ctx.strokeStyle = entity.shape.color ?? this._theme.entity[entity.shape.type].outline;
      this.ctx.shadowBlur = this._theme.entity[entity.shape.type].bloomRadius;
      this.ctx.shadowColor =
        entity.shape.bloomColor ?? entity.shape.color ?? this._theme.entity[entity.shape.type].bloom;
      const shape = entity.shape;
      switch (shape.type) {
        case 'polyline':
          if (shape.points.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(shape.points[0][0], shape.points[0][1]);
            for (let i = 1; i < shape.points.length; i++) {
              this.ctx.lineTo(shape.points[i][0], shape.points[i][1]);
            }
            this.ctx.stroke();
          }
          break;
        case 'box': {
          const w = shape.width * 2;
          const h = shape.height * 2;
          this.ctx.rotate(shape.rotation);
          this.ctx.fillRect(-w / 2, -h / 2, w, h);
          this.ctx.strokeRect(-w / 2, -h / 2, w, h);
          break;
        }
        case 'circle':
          this.ctx.beginPath();
          this.ctx.arc(0, 0, shape.radius, 0, Math.PI * 2, false);
          this.ctx.stroke();
          break;
      }

      this.ctx.setTransform(transform);
    });
    this.ctx.restore();
  }

  private renderEffects({ effects, camera }: RenderParameters) {
    effects.forEach((effect) => effect.render(this.ctx, camera.zoom * initialZoom, this._theme));
  }

  private renderMarbles({ marbles, camera, winnerRange, winners, size }: RenderParameters) {
    const firstIndex = winnerRange.start - winners.length;
    const lastIndex = winnerRange.end - winners.length;

    const viewPort = { x: camera.x, y: camera.y, w: size.x, h: size.y, zoom: camera.zoom * initialZoom };
    marbles.forEach((marble, i) => {
      marble.render(
        this.ctx,
        camera.zoom * initialZoom,
        i >= firstIndex && i <= lastIndex,
        false,
        this.getMarbleImage(marble.name),
        viewPort,
        this._theme
      );
    });
  }

  private renderResult(params: RenderParameters) {
    const result = params.result;
    // 새 결과가 나오면(또는 리셋되면) 닫힘 상태를 푼다. _result는 확정될 때마다 새 배열이다
    if (result !== this._lastResult) {
      this._lastResult = result;
      this._resultPopupClosed = false;
    }
    this._resultCloseRect = null;
    if (!result) return;
    // 1명이면 기존 하단 Winner 표시, 여러명이면 화면 중앙 당첨자 목록 팝업
    if (result.length === 1) {
      this.renderWinner(result[0], params.theme);
    } else if (!this._resultPopupClosed) {
      this.renderWinnerList(result, params);
    }
  }

  /** 결과 팝업 닫기 버튼을 눌렀는지 */
  getResultCloseHitAt(x: number, y: number): boolean {
    return inRect(this._resultCloseRect ?? undefined, x, y);
  }

  closeResultPopup(): void {
    this._resultPopupClosed = true;
  }

  /**
   * 여러명 모드에서 확정된 당첨자를 좌측 상단에 상시 표시한다.
   * 우측은 랭킹 리스트가 구슬 수만큼 내려오므로 겹친다. 좌측은 미니맵이 세로로 긴
   * 스트립이라 그 오른쪽에 붙인다.
   */
  private renderWinnerProgress({ winners, winnerRange, result, theme }: RenderParameters) {
    const { start, end } = winnerRange;
    if (end <= start) return; // 1명 추첨은 기존 하단 Winner 표시를 쓴다

    const ctx = this.ctx;
    const w = this._sceneCanvas.width;
    const h = this._sceneCanvas.height;

    const lineHeight = Math.min(24, Math.max(14, h * 0.042));
    const pad = lineHeight * 0.6;
    const rankWidth = lineHeight * 1.9;
    const headerFont = `bold ${lineHeight * 0.7}px sans-serif`;
    const rankFont = `${lineHeight * 0.6}px sans-serif`;
    const nameFont = `bold ${lineHeight * 0.72}px sans-serif`;

    // 확정 전에는 골인한 당첨자만, 확정 후에는 최종 명단(조기 확정분 포함)을 쓴다
    const confirmed = result ?? winners.slice(start, end + 1);
    const header = `Winners ${confirmed.length} / ${end - start + 1}`;

    // 화면을 넘기면 오래된 쪽을 접는다. 전체 명단은 어차피 중앙 팝업에서 보여준다
    const maxRows = Math.max(1, Math.floor((h * 0.55) / lineHeight) - 2);
    const hidden = Math.max(0, confirmed.length - maxRows);
    const shown = confirmed.slice(hidden);
    const foldLabel = `+${hidden} more`;

    ctx.save();

    ctx.font = headerFont;
    let contentW = ctx.measureText(header).width;
    ctx.font = nameFont;
    for (const marble of shown) {
      contentW = Math.max(contentW, rankWidth + ctx.measureText(marble.name).width);
    }
    if (hidden > 0) {
      ctx.font = rankFont;
      contentW = Math.max(contentW, ctx.measureText(foldLabel).width);
    }

    const panelW = Math.min(contentW + pad * 2, w * PROGRESS_MAX_WIDTH_RATIO);
    const rows = shown.length + (hidden > 0 ? 1 : 0);
    // 헤더와 목록 사이 간격은 목록이 있을 때만 준다. 항상 주면 당첨자가 없을 때
    // 아래쪽에만 빈 공간이 남아 위아래 여백이 어긋난다
    const headerGap = rows > 0 ? lineHeight * 0.35 : 0;
    const panelH = pad * 2 + lineHeight + headerGap + rows * lineHeight;
    const panelX = MINIMAP_INSET + MINIMAP_WIDTH + pad;
    const panelY = MINIMAP_INSET; // 미니맵 상단과 맞춘다

    ctx.fillStyle = theme.winnerBackground;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = PROGRESS_ACCENT;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = headerFont;
    ctx.fillStyle = theme.winnerText;
    ctx.fillText(header, panelX + pad, panelY + pad + lineHeight / 2);

    let y = panelY + pad + lineHeight + headerGap + lineHeight / 2;
    if (hidden > 0) {
      ctx.font = rankFont;
      ctx.fillStyle = theme.winnerText;
      ctx.fillText(foldLabel, panelX + pad, y);
      y += lineHeight;
    }

    shown.forEach((marble, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(panelX, y - lineHeight / 2, panelW, lineHeight);
      ctx.clip();

      ctx.font = rankFont;
      ctx.fillStyle = theme.winnerText;
      ctx.fillText(`#${start + hidden + i + 1}`, panelX + pad, y);

      ctx.font = nameFont;
      ctx.fillStyle = `hsl(${marble.hue} 100% ${theme.marbleLightness}%)`;
      ctx.fillText(marble.name, panelX + pad + rankWidth, y);
      ctx.restore();
      y += lineHeight;
    });

    ctx.restore();
  }

  /** 당첨자가 여러명일 때 화면 중앙에 목록 팝업을 그린다 */
  private renderWinnerList(winners: Marble[], { theme, winnerRange }: RenderParameters) {
    const ctx = this.ctx;
    const w = this._sceneCanvas.width;
    const h = this._sceneCanvas.height;

    const lineHeight = Math.min(32, Math.max(16, h * 0.05));
    const padding = lineHeight;
    const titleHeight = lineHeight * 2;

    // 세로로 다 안 들어가면 열을 늘린다
    const maxRows = Math.max(
      1,
      Math.floor((h * RESULT_PANEL_MAX_HEIGHT_RATIO - titleHeight - padding * 2) / lineHeight)
    );
    const cols = Math.max(1, Math.ceil(winners.length / maxRows));
    const rows = Math.ceil(winners.length / cols);

    const colWidth = Math.min(RESULT_COLUMN_MAX_WIDTH, (w * RESULT_PANEL_MAX_WIDTH_RATIO - padding * 2) / cols);
    const panelW = colWidth * cols + padding * 2;
    const panelH = titleHeight + rows * lineHeight + padding;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;

    ctx.save();

    ctx.fillStyle = theme.winnerBackground;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = theme.background;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = theme.winnerText;
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.winnerText;
    ctx.font = `bold ${lineHeight * 1.1}px sans-serif`;
    ctx.fillText(`Winners (${winners.length})`, w / 2, panelY + titleHeight / 2);

    // 버튼 중심을 팝업 우상단 꼭지점에 맞춰 걸쳐놓는다. 뒤가 비치지 않게 불투명하게 채우되,
    // 검정으로 채우면 다크 테마에서 배경과 같아져 버튼으로 안 보이므로 대비되는 색을 쓴다
    this._resultCloseRect = drawCloseCircle(ctx, panelX + panelW, panelY, closeButtonSize(h), '#222');

    const rankWidth = lineHeight * 1.8;
    winners.forEach((marble, i) => {
      const col = Math.floor(i / rows);
      const row = i % rows;
      const x = panelX + padding + col * colWidth;
      const y = panelY + titleHeight + row * lineHeight + lineHeight / 2;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y - lineHeight / 2, colWidth, lineHeight);
      ctx.clip();

      ctx.textAlign = 'right';
      ctx.fillStyle = theme.winnerText;
      ctx.font = `${lineHeight * 0.6}px sans-serif`;
      ctx.fillText(`#${winnerRange.start + i + 1}`, x + rankWidth * 0.8, y);

      ctx.textAlign = 'left';
      ctx.fillStyle = `hsl(${marble.hue} 100% ${theme.marbleLightness}%)`;
      ctx.font = `bold ${lineHeight * 0.75}px sans-serif`;
      ctx.fillText(marble.name, x + rankWidth, y);
      ctx.restore();
    });

    ctx.restore();
  }

  private renderWinner(winner: Marble, theme: ColorTheme) {
    this.ctx.save();
    this.ctx.fillStyle = theme.winnerBackground;
    this.ctx.fillRect(
      this._sceneCanvas.width / 2,
      this._sceneCanvas.height - winnerAreaHeight,
      this._sceneCanvas.width / 2,
      winnerAreaHeight
    );

    // Draw marble image or colored circle
    const marbleSize = 100;
    const marbleCenterX = this._sceneCanvas.width - marbleSize / 2 - 20;
    const marbleCenterY = this._sceneCanvas.height - winnerAreaHeight / 2;
    const marbleImage = this.getMarbleImage(winner.name);

    if (marbleImage) {
      this.ctx.drawImage(
        marbleImage,
        marbleCenterX - marbleSize / 2,
        marbleCenterY - marbleSize / 2,
        marbleSize,
        marbleSize
      );
    } else {
      this.ctx.beginPath();
      this.ctx.arc(marbleCenterX, marbleCenterY, marbleSize / 2, 0, Math.PI * 2);
      this.ctx.fillStyle = `hsl(${winner.hue} 100% ${theme.marbleLightness})`;
      this.ctx.fill();
    }

    this.ctx.fillStyle = theme.winnerText;
    this.ctx.strokeStyle = theme.winnerOutline;

    this.ctx.font = 'bold 48px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.lineWidth = 4;
    const textRightX = marbleCenterX - marbleSize / 2 - 20;
    if (theme.winnerOutline) {
      this.ctx.strokeText('Winner', textRightX, this._sceneCanvas.height - 120 + WINNER_TEXT_OFFSET);
    }

    this.ctx.fillText('Winner', textRightX, this._sceneCanvas.height - 120 + WINNER_TEXT_OFFSET);
    this.ctx.font = 'bold 72px sans-serif';
    this.ctx.fillStyle = `hsl(${winner.hue} 100% ${theme.marbleLightness})`;
    if (theme.winnerOutline) {
      this.ctx.strokeText(winner.name, textRightX, this._sceneCanvas.height - 55 + WINNER_TEXT_OFFSET);
    }
    this.ctx.fillText(winner.name, textRightX, this._sceneCanvas.height - 55 + WINNER_TEXT_OFFSET);
    this.ctx.restore();
  }
}
