/**
 * Reusable editor tool + cursor state management.
 * Keeps visual feedback consistent across pan, draw, and select modes.
 */

export const EditorTool = {
  /** Pan/zoom canvas; click does not add points. */
  NAVIGATE: 'navigate',
  /** Place and edit path anchors (default mask editor). */
  DRAW: 'draw',
  /** Select anchors only; no new points. */
  SELECT: 'select',
};

export const CursorState = {
  DEFAULT: 'default',
  DRAW_CROSSHAIR: 'draw-crosshair',
  SELECT_POINTER: 'select-pointer',
  HOVER_ANCHOR: 'hover-anchor',
  HOVER_HANDLE: 'hover-handle',
  HOVER_EDGE: 'hover-edge',
  PAN_READY: 'pan-ready',
  PANNING: 'panning',
  MOVE: 'move',
};

/** CSS cursor values (widely supported). */
const CURSOR_MAP = {
  [CursorState.DEFAULT]: 'default',
  [CursorState.DRAW_CROSSHAIR]: 'crosshair',
  [CursorState.SELECT_POINTER]: 'default',
  [CursorState.HOVER_ANCHOR]: 'pointer',
  [CursorState.HOVER_HANDLE]: 'grab',
  [CursorState.HOVER_EDGE]: 'cell',
  [CursorState.PAN_READY]: 'grab',
  [CursorState.PANNING]: 'grabbing',
  [CursorState.MOVE]: 'move',
};

/** CSS class names on canvas for optional styling hooks. */
export const TOOL_CLASS = {
  [EditorTool.NAVIGATE]: 'editor-tool-navigate',
  [EditorTool.DRAW]: 'editor-tool-draw',
  [EditorTool.SELECT]: 'editor-tool-select',
};

export class EditorInteractionState {
  /**
   * @param {HTMLElement} element — usually the editor canvas
   * @param {{ defaultTool?: string }} [options]
   */
  constructor(element, options = {}) {
    this.element = element;
    this.tool = options.defaultTool ?? EditorTool.DRAW;
    /** @type {string | null} Locks cursor during active pointer gesture. */
    this._transient = null;
    this._lastCss = '';
    this._shiftHeld = false;
    this.syncToolClass();
    this.applyIdle();
  }

  setTool(tool) {
    if (this.tool === tool) return;
    this.tool = tool;
    this.syncToolClass();
    if (!this._transient) this.applyIdle();
  }

  getTool() {
    return this.tool;
  }

  setShiftHeld(held) {
    this._shiftHeld = held;
  }

  syncToolClass() {
    for (const cls of Object.values(TOOL_CLASS)) {
      this.element.classList.remove(cls);
    }
    const cls = TOOL_CLASS[this.tool];
    if (cls) this.element.classList.add(cls);
  }

  /**
   * Override idle/hover cursor during drag (pan, move anchor, etc.).
   * @param {string} state — CursorState value
   */
  setTransient(state) {
    this._transient = state;
    this.apply(state);
  }

  clearTransient() {
    this._transient = null;
    this.applyIdle();
  }

  /**
   * @param {{ anchor?: boolean, handle?: boolean, edge?: boolean }} hover
   */
  applyIdle(hover = null) {
    if (this._transient) return;

    if (hover) {
      if (hover.handle) this.apply(CursorState.HOVER_HANDLE);
      else if (hover.anchor) this.apply(CursorState.HOVER_ANCHOR);
      else if (hover.edge) this.apply(CursorState.HOVER_EDGE);
      else this.apply(this.idleCursorForTool());
      return;
    }

    this.apply(this.idleCursorForTool());
  }

  idleCursorForTool() {
    switch (this.tool) {
      case EditorTool.NAVIGATE:
        return CursorState.PAN_READY;
      case EditorTool.SELECT:
        return CursorState.SELECT_POINTER;
      case EditorTool.DRAW:
      default:
        return CursorState.DRAW_CROSSHAIR;
    }
  }

  /**
   * Resolve hover from hit targets + current tool.
   * @param {{ anchor?: boolean, handle?: boolean, edge?: boolean }} hits
   */
  resolveHover(hits) {
    if (this.tool === EditorTool.NAVIGATE) {
      return CursorState.PAN_READY;
    }
    if (hits.handle) return CursorState.HOVER_HANDLE;
    if (hits.anchor) return CursorState.HOVER_ANCHOR;
    if (hits.edge && this.tool === EditorTool.DRAW) return CursorState.HOVER_EDGE;
    return null;
  }

  /**
   * @param {string} state — CursorState key
   */
  apply(state) {
    const css = CURSOR_MAP[state] ?? CURSOR_MAP[CursorState.DEFAULT];
    if (css === this._lastCss) return;
    this._lastCss = css;
    this.element.style.cursor = css;
  }

  /** Space held → temporary pan cursor. */
  applySpacePan(pressed) {
    if (this._transient) return;
    if (pressed) {
      this.apply(CursorState.PAN_READY);
    } else {
      this.applyIdle();
    }
  }
}
