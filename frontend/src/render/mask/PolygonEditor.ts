import {
  drawLensPath,
  hitTestHandle,
  hitTestPathEdge,
  hitTestVertex,
  insertPointOnSegment,
  normFromPx,
  toggleSegmentCurved,
  traceLensPath,
} from "./bezier-path";
import {
  SmoothCursorZoom,
  applyPanOffset,
  fitViewportToScreen,
  formatZoomPercent,
  resetViewportToDefault,
} from "./canvas-viewport";
import { UI_CANVAS_BACKGROUND } from "../constants";
import {
  CursorState,
  EditorInteractionState,
  EditorTool,
} from "./editor-interaction";
import {
  applyEditorState,
  captureEditorState,
  MAX_EDITOR_HISTORY,
} from "./lens-history";
import { migrateAnchors, normalizeAnchor } from "./mask-types";

const CLICK_THRESHOLD_PX = 7;
const DRAG_THRESHOLD_PX = 4;

/**
 * Vector path editor with cubic Bézier segments between anchors.
 */
export class PolygonEditor {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLImageElement} image
   * @param {import('./types.js').LensPolygon[]} lenses
   * @param {{ onChange?: () => void, tool?: string, externalHistory?: boolean }} options
   */
  constructor(canvas, image, lenses, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = image;
    this.lenses = lenses.map((l) => ({
      ...l,
      points: migrateAnchors(l.points),
    }));
    this.onChange = options.onChange ?? (() => {});
    this.onToolChange = options.onToolChange ?? (() => {});
    this.onHistoryChange = options.onHistoryChange ?? (() => {});
    this.onViewportChange = options.onViewportChange ?? (() => {});
    /** When true, parent owns undo/redo + Delete; skip internal history/shortcuts. */
    this.externalHistory = Boolean(options.externalHistory);

    /** @type {import('./lens-history.js').EditorHistorySnapshot[]} */
    this._historyPast = [];
    /** @type {import('./lens-history.js').EditorHistorySnapshot[]} */
    this._historyFuture = [];
    this._historyApplying = false;
    this._historyRecordedForGesture = false;

    this.activeLensIndex = 0;
    this.selectedPointIndex = -1;
    this.showPreview = true;
    this.showHandles = true;
    this.spacePan = false;
    this.smoothHandles = true;
    this._shiftHeld = false;

    this.imgW = image.naturalWidth;
    this.imgH = image.naturalHeight;

    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    this.interaction = null;
    this._dragStart = null;
    this._pendingClickTimer = null;
    this._layoutW = 0;
    this._layoutH = 0;

    this._smoothZoom = new SmoothCursorZoom({
      getState: () => ({
        scale: this.scale,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
      }),
      setState: (next) => {
        this.scale = next.scale;
        this.offsetX = next.offsetX;
        this.offsetY = next.offsetY;
      },
      onFrame: () => {
        this.draw();
        this._emitViewportChange();
      },
    });

    this.cursorState = new EditorInteractionState(canvas, {
      defaultTool: options.tool ?? EditorTool.DRAW,
    });

    this._onPointerDown = this.onPointerDown.bind(this);
    this._onPointerMove = this.onPointerMove.bind(this);
    this._onPointerUp = this.onPointerUp.bind(this);
    this._onWheel = this.onWheel.bind(this);
    this._onKeyDown = this.onKeyDown.bind(this);
    this._onKeyUp = this.onKeyUp.bind(this);
    this._onDblClick = this.onDblClick.bind(this);
    this._onPointerLeave = this.onPointerLeave.bind(this);

    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
    canvas.addEventListener('dblclick', this._onDblClick);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this.fitToView();
    this.draw();
  }

  destroy() {
    if (this._pendingClickTimer) clearTimeout(this._pendingClickTimer);
    this._smoothZoom?.destroy();
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
    this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    this.canvas.removeEventListener('dblclick', this._onDblClick);
    this.canvas.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }

  setTool(tool) {
    if (this.cursorState.getTool() === tool) return;
    this.cursorState.setTool(tool);
    this.interaction = null;
    this.updateHoverCursor();
    this.onToolChange(tool);
  }

  getTool() {
    return this.cursorState.getTool();
  }

  get activeLens() {
    return this.lenses[this.activeLensIndex];
  }

  setActiveLens(index) {
    this.activeLensIndex = index;
    this.selectedPointIndex = -1;
    this.draw();
    this.updateHoverCursor();
  }

  fitToView() {
    this._smoothZoom.cancel();
    const rect = this.canvas.getBoundingClientRect();
    const next = fitViewportToScreen(rect.width, rect.height, this.imgW, this.imgH);
    this.scale = next.scale;
    this.offsetX = next.offsetX;
    this.offsetY = next.offsetY;
    this.draw();
    this._emitViewportChange();
  }

  /** Instantly return to 100% zoom with the frame centered. */
  resetView() {
    this._smoothZoom.cancel();
    const rect = this.canvas.getBoundingClientRect();
    const next = resetViewportToDefault(rect.width, rect.height, this.imgW, this.imgH);
    this.scale = next.scale;
    this.offsetX = next.offsetX;
    this.offsetY = next.offsetY;
    this.draw();
    this._emitViewportChange();
  }

  getZoomPercentLabel() {
    return formatZoomPercent(this.scale);
  }

  _emitViewportChange() {
    this.onViewportChange({
      scale: this.scale,
      zoomLabel: formatZoomPercent(this.scale),
    });
  }

  screenToImage(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale,
    };
  }

  screenDist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  clampImageCoords(x, y) {
    return {
      x: Math.min(this.imgW, Math.max(0, x)),
      y: Math.min(this.imgH, Math.max(0, y)),
    };
  }

  hitRadius() {
    return 12 / this.scale;
  }

  hitTestHover(ip) {
    const lens = this.activeLens;
    const hitR = this.hitRadius();
    const handle = hitTestHandle(ip.x, ip.y, lens.points, this.imgW, this.imgH, hitR * 0.9);
    const anchor = hitTestVertex(ip.x, ip.y, lens.points, this.imgW, this.imgH, hitR);
    let edge = false;
    const tool = this.cursorState.getTool();
    const allowEdge =
      tool === EditorTool.SELECT ||
      (tool === EditorTool.DRAW && this._shiftHeld);
    if (allowEdge && lens.points.length > 0) {
      edge = Boolean(
        hitTestPathEdge(ip.x, ip.y, lens.points, this.imgW, this.imgH, 12 / this.scale),
      );
    }
    return {
      handle: Boolean(handle),
      anchor: Boolean(anchor),
      edge,
    };
  }

  isPointInActivePath(ip) {
    const lens = this.activeLens;
    if (lens.points.length < 3) return false;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.beginPath();
    traceLensPath(this.ctx, lens, this.imgW, this.imgH, true);
    const inside = this.ctx.isPointInPath(ip.x, ip.y);
    this.ctx.restore();
    return inside;
  }

  updateHoverCursor(e) {
    if (this.interaction) return;
    if (this.spacePan) {
      this.cursorState.applySpacePan(true);
      return;
    }
    const ip = e
      ? this.screenToImage(e.clientX, e.clientY)
      : { x: -9999, y: -9999 };
    const hits = e ? this.hitTestHover(ip) : null;
    if (
      e &&
      hits &&
      !hits.handle &&
      !hits.anchor &&
      !hits.edge &&
      this.cursorState.getTool() === EditorTool.SELECT &&
      this.isPointInActivePath(ip)
    ) {
      this.cursorState.setTransient(CursorState.MOVE);
      return;
    }
    this.cursorState.clearTransient();
    this.cursorState.applyIdle(
      hits ? { handle: hits.handle, anchor: hits.anchor, edge: hits.edge } : null,
    );
  }

  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w < 8 || h < 8) return;
    if (w === this._layoutW && h === this._layoutH) return;

    this._layoutW = w;
    this._layoutH = h;

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);

    const fillStage = this.canvas.dataset.fillStage === "true";
    if (fillStage) {
      this.canvas.style.width = "";
      this.canvas.style.height = "";
    } else {
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  draw() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.ctx.save();
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = UI_CANVAS_BACKGROUND;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.drawImage(this.image, 0, 0, this.imgW, this.imgH);

    const lw = 2 / this.scale;

    if (this.showPreview) {
      for (let i = 0; i < this.lenses.length; i++) {
        const lens = this.lenses[i];
        if (lens.points.length < 3) continue;
        const active = i === this.activeLensIndex;
        drawLensPath(this.ctx, lens, this.imgW, this.imgH, {
          fill: active ? 'rgba(0, 120, 255, 0.32)' : 'rgba(0, 120, 255, 0.15)',
          stroke: active ? '#0078ff' : 'rgba(0, 120, 255, 0.6)',
          lineWidth: lw,
          showHandles: this.showHandles && active,
          active,
        });
      }
    } else {
      const lens = this.activeLens;
      if (lens.points.length >= 2) {
        drawLensPath(this.ctx, lens, this.imgW, this.imgH, {
          fill: null,
          stroke: '#0078ff',
          lineWidth: lw,
          showHandles: this.showHandles,
          active: true,
        });
      }
    }

    this.drawAnchorHandles();
    this.ctx.restore();
  }

  drawAnchorHandles() {
    const hitR = 6 / this.scale;
    for (let li = 0; li < this.lenses.length; li++) {
      const lens = this.lenses[li];
      const isActive = li === this.activeLensIndex;
      if (!isActive && this.showPreview) continue;

      for (let pi = 0; pi < lens.points.length; pi++) {
        const a = lens.points[pi];
        const ap = { x: a.x * this.imgW, y: a.y * this.imgH };
        const selected = isActive && pi === this.selectedPointIndex;

        const drawKnob = (px, py, fill, r) => {
          this.ctx.beginPath();
          this.ctx.arc(px, py, r, 0, Math.PI * 2);
          this.ctx.fillStyle = fill;
          this.ctx.fill();
          this.ctx.strokeStyle = '#fff';
          this.ctx.lineWidth = 1.2 / this.scale;
          this.ctx.stroke();
        };

        if (isActive && this.showHandles) {
          if (a.handleIn) {
            const hi = { x: a.handleIn.x * this.imgW, y: a.handleIn.y * this.imgH };
            drawKnob(hi.x, hi.y, '#7eb6ff', hitR * 0.85);
          }
          if (a.handleOut) {
            const ho = { x: a.handleOut.x * this.imgW, y: a.handleOut.y * this.imgH };
            drawKnob(ho.x, ho.y, '#7eb6ff', hitR * 0.85);
          }
        }

        drawKnob(ap.x, ap.y, selected ? '#FBF8F3' : isActive ? '#646345' : '#D9BBB0', selected ? hitR * 1.2 : hitR);
        if (a.curved && isActive) {
          this.ctx.fillStyle = '#0078ff';
          this.ctx.beginPath();
          this.ctx.arc(ap.x, ap.y, hitR * 0.35, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }
  }

  onPointerDown(e) {
    if (e.button === 2) return;

    this.canvas.setPointerCapture(e.pointerId);
    const lens = this.activeLens;
    const ip = this.screenToImage(e.clientX, e.clientY);
    const hitR = this.hitRadius();
    const startScreen = { x: e.clientX, y: e.clientY };
    const startOffset = { x: this.offsetX, y: this.offsetY };
    const tool = this.cursorState.getTool();

    if (e.button === 1 || this.spacePan) {
      e.preventDefault();
      this.interaction = { mode: 'pan', startScreen, startOffset };
      this.cursorState.setTransient(CursorState.PANNING);
      return;
    }

    const handleHit = hitTestHandle(ip.x, ip.y, lens.points, this.imgW, this.imgH, hitR * 0.9);
    if (handleHit) {
      const pt = lens.points[handleHit.index];
      this.selectedPointIndex = handleHit.index;
      this._dragStart = {
        anchor: { x: pt.x, y: pt.y },
        handleIn: pt.handleIn ? { ...pt.handleIn } : null,
        handleOut: pt.handleOut ? { ...pt.handleOut } : null,
      };
      this._historyRecordedForGesture = false;
      this.interaction = {
        mode: 'dragHandle',
        handleType: handleHit.type,
        lensIndex: this.activeLensIndex,
        pointIndex: handleHit.index,
        startScreen,
        activated: false,
      };
      this.cursorState.setTransient(CursorState.HOVER_HANDLE);
      this.draw();
      return;
    }

    const vertexHit = hitTestVertex(ip.x, ip.y, lens.points, this.imgW, this.imgH, hitR);
    if (vertexHit) {
      const pt = lens.points[vertexHit.index];
      this.selectedPointIndex = vertexHit.index;
      this._dragStart = {
        anchor: { x: pt.x, y: pt.y },
        handleIn: pt.handleIn ? { ...pt.handleIn } : null,
        handleOut: pt.handleOut ? { ...pt.handleOut } : null,
      };
      this._historyRecordedForGesture = false;
      this.interaction = {
        mode: 'dragAnchor',
        lensIndex: this.activeLensIndex,
        pointIndex: vertexHit.index,
        startScreen,
        activated: false,
      };
      this.cursorState.setTransient(CursorState.MOVE);
      this.draw();
      return;
    }

    if (tool === EditorTool.NAVIGATE || e.altKey) {
      this.interaction = { mode: 'pan', startScreen, startOffset };
      this.cursorState.setTransient(CursorState.PANNING);
      return;
    }

    if (tool === EditorTool.SELECT) {
      const edgeHit =
        lens.points.length > 0
          ? hitTestPathEdge(ip.x, ip.y, lens.points, this.imgW, this.imgH, 12 / this.scale)
          : null;
      if (edgeHit) {
        this.interaction = {
          mode: 'navigate',
          startScreen,
          startOffset,
          startImage: { ...ip },
          shiftKey: e.shiftKey,
          activated: false,
        };
        this.cursorState.setTransient(CursorState.HOVER_EDGE);
        return;
      }
      if (lens.points.length >= 3 && this.isPointInActivePath(ip)) {
        this.selectedPointIndex = -1;
        this._historyRecordedForGesture = false;
        this.interaction = {
          mode: 'dragPath',
          lensIndex: this.activeLensIndex,
          startScreen,
          startImage: { ...ip },
          startPoints: migrateAnchors(lens.points),
          activated: false,
        };
        this.cursorState.setTransient(CursorState.MOVE);
        this.draw();
        return;
      }
    }

    this.interaction = {
      mode: 'navigate',
      startScreen,
      startOffset,
      startImage: { ...ip },
      shiftKey: e.shiftKey,
      activated: false,
    };
    this.cursorState.setTransient(CursorState.PAN_READY);
  }

  onPointerMove(e) {
    this._shiftHeld = e.shiftKey;

    const i = this.interaction;
    if (!i) {
      this.updateHoverCursor(e);
      return;
    }

    const dist = this.screenDist(i.startScreen.x, i.startScreen.y, e.clientX, e.clientY);

    if (i.mode === 'pan' || i.mode === 'navigate') {
      if (i.mode === 'navigate' && dist < CLICK_THRESHOLD_PX) return;
      if (i.mode === 'navigate' && !i.activated) {
        i.mode = 'pan';
        i.activated = true;
      }
      const pan = applyPanOffset(i.startOffset, i.startScreen, e.clientX, e.clientY);
      this.offsetX = pan.offsetX;
      this.offsetY = pan.offsetY;
      this.cursorState.setTransient(CursorState.PANNING);
      this.draw();
      return;
    }

    if (i.mode === 'dragAnchor' || i.mode === 'dragHandle') {
      if (!i.activated && dist < DRAG_THRESHOLD_PX) return;
      if (!i.activated && !this._historyRecordedForGesture) {
        this._recordHistory();
        this._historyRecordedForGesture = true;
      }
      i.activated = true;

      const ip = this.screenToImage(e.clientX, e.clientY);
      const clamped = this.clampImageCoords(ip.x, ip.y);
      const norm = normFromPx(clamped.x, clamped.y, this.imgW, this.imgH);
      const lens = this.lenses[i.lensIndex];
      const pt = lens.points[i.pointIndex];

      if (i.mode === 'dragHandle') {
        this.cursorState.setTransient(CursorState.HOVER_HANDLE);
        if (i.handleType === 'handleIn') {
          pt.handleIn = { x: norm.x, y: norm.y };
          if (this.smoothHandles && pt.handleOut) {
            const dx = norm.x - pt.x;
            const dy = norm.y - pt.y;
            pt.handleOut = { x: pt.x - dx, y: pt.y - dy };
          }
        } else {
          pt.handleOut = { x: norm.x, y: norm.y };
          if (this.smoothHandles && pt.handleIn) {
            const dx = norm.x - pt.x;
            const dy = norm.y - pt.y;
            pt.handleIn = { x: pt.x - dx, y: pt.y - dy };
          }
        }
      } else {
        this.cursorState.setTransient(CursorState.MOVE);
        const dx = norm.x - pt.x;
        const dy = norm.y - pt.y;
        pt.x = norm.x;
        pt.y = norm.y;
        if (pt.handleIn) {
          pt.handleIn = { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy };
        }
        if (pt.handleOut) {
          pt.handleOut = { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy };
        }
      }

      this.emitChange();
      this.draw();
      return;
    }

    if (i.mode === 'dragPath') {
      if (!i.activated && dist < DRAG_THRESHOLD_PX) return;
      if (!i.activated && !this._historyRecordedForGesture) {
        this._recordHistory();
        this._historyRecordedForGesture = true;
      }
      i.activated = true;
      this.cursorState.setTransient(CursorState.MOVE);
      const ip = this.screenToImage(e.clientX, e.clientY);
      const dx = (ip.x - i.startImage.x) / this.imgW;
      const dy = (ip.y - i.startImage.y) / this.imgH;
      const lens = this.lenses[i.lensIndex];
      lens.points = i.startPoints.map((p) => ({
        ...p,
        x: p.x + dx,
        y: p.y + dy,
        handleIn: p.handleIn ? { x: p.handleIn.x + dx, y: p.handleIn.y + dy } : undefined,
        handleOut: p.handleOut ? { x: p.handleOut.x + dx, y: p.handleOut.y + dy } : undefined,
      }));
      this.emitChange();
      this.draw();
    }
  }

  onPointerUp(e) {
    const i = this.interaction;
    if (!i) return;

    const dist = this.screenDist(i.startScreen.x, i.startScreen.y, e.clientX, e.clientY);

    if (i.mode === 'navigate' && dist <= CLICK_THRESHOLD_PX) {
      this.scheduleClickAction(i);
    }

    if (i.mode === 'dragAnchor' && !i.activated && dist <= CLICK_THRESHOLD_PX) {
      this.selectedPointIndex = i.pointIndex;
      this.draw();
    }

    this.interaction = null;
    this._dragStart = null;
    this.cursorState.clearTransient();
    this.updateHoverCursor(e);
    this.draw();
  }

  onPointerLeave() {
    if (!this.interaction) {
      this.cursorState.applyIdle();
    }
  }

  addPointAt(ix, iy) {
    this._recordHistory();
    const clamped = this.clampImageCoords(ix, iy);
    const lens = this.activeLens;
    const anchor = normalizeAnchor(normFromPx(clamped.x, clamped.y, this.imgW, this.imgH));
    lens.points.push(anchor);
    this.selectedPointIndex = lens.points.length - 1;
    this.emitChange();
    this.draw();
  }

  scheduleClickAction(navigateState) {
    if (this._pendingClickTimer) clearTimeout(this._pendingClickTimer);
    this._pendingClickTimer = setTimeout(() => {
      this._pendingClickTimer = null;
      this.commitNavigateClick(navigateState);
    }, 220);
  }

  commitNavigateClick(i) {
    const lens = this.activeLens;
    const ip = i.startImage;
    const tool = this.cursorState.getTool();
    const vtx = hitTestVertex(ip.x, ip.y, lens.points, this.imgW, this.imgH, this.hitRadius());

    if (vtx) {
      this.selectedPointIndex = vtx.index;
      this.draw();
      return;
    }

    const edge =
      lens.points.length > 0
        ? hitTestPathEdge(ip.x, ip.y, lens.points, this.imgW, this.imgH, 12 / this.scale)
        : null;

    if (tool === EditorTool.SELECT) {
      if (edge) {
        this._recordHistory();
        lens.points = insertPointOnSegment(lens.points, edge.segIndex, edge.t, this.imgW, this.imgH);
        this.selectedPointIndex = edge.insertAt;
        this.emitChange();
        this.draw();
      }
      return;
    }

    if (tool === EditorTool.DRAW && i.shiftKey && edge) {
      this._recordHistory();
      lens.points = insertPointOnSegment(lens.points, edge.segIndex, edge.t, this.imgW, this.imgH);
      this.selectedPointIndex = edge.insertAt;
      this.emitChange();
      this.draw();
      return;
    }

    if (tool === EditorTool.DRAW) {
      this.addPointAt(ip.x, ip.y);
    }
  }

  onDblClick(e) {
    if (this._pendingClickTimer) {
      clearTimeout(this._pendingClickTimer);
      this._pendingClickTimer = null;
    }
    const ip = this.screenToImage(e.clientX, e.clientY);
    const vertexHit = hitTestVertex(ip.x, ip.y, this.activeLens.points, this.imgW, this.imgH, this.hitRadius());
    if (vertexHit) {
      this.toggleSegmentAt(vertexHit.index);
    }
  }

  toggleSegmentAt(index) {
    this._recordHistory();
    const lens = this.activeLens;
    lens.points = toggleSegmentCurved(lens.points, index, this.imgW, this.imgH);
    this.selectedPointIndex = index;
    this.emitChange();
    this.draw();
  }

  onWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this._smoothZoom.handleWheel(e, rect);
  }

  /** Ignore editor shortcuts while the user is typing in a form field. */
  _isTypingInFormField(e) {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return false;
    return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
  }

  onKeyDown(e) {
    if (this._isTypingInFormField(e)) return;

    if (e.code === 'Space' && !e.repeat) {
      this.spacePan = true;
      this.cursorState.applySpacePan(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'Shift') this._shiftHeld = true;

    if (e.key === 'v' || e.key === 'V') {
      this.setTool(EditorTool.SELECT);
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      this.setTool(EditorTool.DRAW);
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      this.setTool(EditorTool.NAVIGATE);
      return;
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedPointIndex >= 0) {
      if (this.externalHistory) return;
      e.preventDefault();
      this.removeSelectedPoint();
    }
    if (e.key === 'Escape') {
      this.interaction = null;
      this.selectedPointIndex = -1;
      this.cursorState.clearTransient();
      this.draw();
      this.updateHoverCursor();
    }
    if (e.key === 'c' || e.key === 'C') {
      if (this.selectedPointIndex >= 0) {
        this.toggleSegmentAt(this.selectedPointIndex);
      }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (this.externalHistory) return;
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
      if (this.externalHistory) return;
      e.preventDefault();
      this.redo();
    }
  }

  onKeyUp(e) {
    if (this._isTypingInFormField(e)) return;

    if (e.code === 'Space') {
      this.spacePan = false;
      this.cursorState.applySpacePan(false);
      this.updateHoverCursor();
    }
    if (e.key === 'Shift') {
      this._shiftHeld = false;
      this.updateHoverCursor();
    }
  }

  removeSelectedPoint() {
    const lens = this.activeLens;
    if (this.selectedPointIndex < 0 || !lens.points.length) return;
    if (lens.points.length <= 3) return;
    this._recordHistory();
    lens.points.splice(this.selectedPointIndex, 1);
    this.selectedPointIndex = Math.min(this.selectedPointIndex, lens.points.length - 1);
    this.emitChange();
    this.draw();
  }

  clearActiveLens() {
    this._recordHistory();
    this.activeLens.points = [];
    this.selectedPointIndex = -1;
    this.emitChange();
    this.draw();
  }

  /** Replace all lens paths (e.g. after auto-detect) without reloading the image. */
  replaceLenses(lenses) {
    this._recordHistory();
    this.lenses = lenses.map((l) => ({
      ...l,
      points: migrateAnchors(l.points),
    }));
    this.activeLensIndex = Math.min(this.activeLensIndex, Math.max(0, this.lenses.length - 1));
    this.selectedPointIndex = -1;
    this.emitChange();
    this.fitToView();
    this.draw();
  }

  /** @deprecated Use undo() for full history. */
  undoLastPoint() {
    this.undo();
  }

  _recordHistory() {
    if (this.externalHistory) return;
    if (this._historyApplying) return;
    this._historyPast.push(captureEditorState(this));
    if (this._historyPast.length > MAX_EDITOR_HISTORY) {
      this._historyPast.shift();
    }
    this._historyFuture = [];
    this._notifyHistory();
  }

  _notifyHistory() {
    this.onHistoryChange();
  }

  canUndo() {
    return this._historyPast.length > 0;
  }

  canRedo() {
    return this._historyFuture.length > 0;
  }

  undo() {
    if (!this.canUndo()) return false;
    this._historyApplying = true;
    try {
      this._historyFuture.unshift(captureEditorState(this));
      const snap = this._historyPast.pop();
      if (snap) applyEditorState(this, snap);
    } finally {
      this._historyApplying = false;
    }
    this.emitChange();
    this.draw();
    this._notifyHistory();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this._historyApplying = true;
    try {
      this._historyPast.push(captureEditorState(this));
      const snap = this._historyFuture.shift();
      if (snap) applyEditorState(this, snap);
    } finally {
      this._historyApplying = false;
    }
    this.emitChange();
    this.draw();
    this._notifyHistory();
    return true;
  }

  emitChange() {
    this.onChange();
  }

  getLenses() {
    return this.lenses;
  }
}
