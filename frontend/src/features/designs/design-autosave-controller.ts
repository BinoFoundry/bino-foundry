import type { SaveDesignRequest, SavedDesignSummary } from "@bino-foundry/shared/types";

export type DesignAutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error" | "offline";

/** `explicit` (default): track dirty locally; server save only via `flush()`. `autosave`: legacy debounce → server. */
export type DesignPersistMode = "explicit" | "autosave";

export type DesignAutoSaveBuildContext = {
  includeThumbnail: boolean;
};

export type DesignAutoSaveBuildFn = (
  ctx: DesignAutoSaveBuildContext,
) => SaveDesignRequest | null | Promise<SaveDesignRequest | null>;

export type DesignAutoSaveSaveFn = (
  request: SaveDesignRequest,
  options: { designId?: string; silent: true },
) => Promise<SavedDesignSummary | null>;

export interface DesignAutoSaveControllerOptions {
  debounceMs?: number;
  /** Default `explicit` — no server calls until `flush()`. */
  mode?: DesignPersistMode;
  save: DesignAutoSaveSaveFn;
  onStatus: (status: DesignAutoSaveStatus) => void;
  onSaved?: (summary: SavedDesignSummary) => void;
  /** Called when the dirty draft changes (local persistence). Never triggers a server save. */
  onDraftChange?: (draft: {
    fingerprint: string;
    visualFingerprint: string;
    build: DesignAutoSaveBuildFn;
  }) => void;
  getDesignId: () => string | null;
}

export class DesignAutoSaveController {
  private debounceMs: number;
  private mode: DesignPersistMode;
  private save: DesignAutoSaveSaveFn;
  private onStatus: (status: DesignAutoSaveStatus) => void;
  private onSaved?: (summary: SavedDesignSummary) => void;
  private onDraftChange?: DesignAutoSaveControllerOptions["onDraftChange"];
  private getDesignId: () => string | null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  /** True when a newer edit arrived while a save was in flight — coalesce after success only. */
  private coalesceAfterFlight = false;
  private paused = false;
  private interactionHold = false;
  private lastSavedFingerprint: string | null = null;
  private lastThumbnailFingerprint: string | null = null;
  private pendingFingerprint: string | null = null;
  private pendingVisualFingerprint: string | null = null;
  private pendingBuild: DesignAutoSaveBuildFn | null = null;

  constructor(options: DesignAutoSaveControllerOptions) {
    this.debounceMs = options.debounceMs ?? 1000;
    this.mode = options.mode ?? "explicit";
    this.save = options.save;
    this.onStatus = options.onStatus;
    this.onSaved = options.onSaved;
    this.onDraftChange = options.onDraftChange;
    this.getDesignId = options.getDesignId;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.clearDebounce();
    }
  }

  /** Pause debounced autosaves while the user is dragging, zooming, or panning. */
  setInteractionHold(hold: boolean): void {
    if (this.interactionHold === hold) return;
    this.interactionHold = hold;
    if (hold) {
      this.clearDebounce();
      return;
    }
    this.armDebounce();
  }

  private armDebounce(): void {
    if (this.mode !== "autosave") return;
    if (this.paused || this.interactionHold) return;
    if (!this.pendingFingerprint || !this.pendingBuild) return;
    if (this.pendingFingerprint === this.lastSavedFingerprint) return;

    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.runSave();
    }, this.debounceMs);
  }

  setBaseline(fingerprint: string, visualFingerprint?: string): void {
    this.lastSavedFingerprint = fingerprint;
    if (visualFingerprint) {
      this.lastThumbnailFingerprint = visualFingerprint;
    }
    this.pendingFingerprint = null;
    this.pendingBuild = null;
    this.coalesceAfterFlight = false;
    this.clearDebounce();
    this.onStatus("saved");
  }

  hasPendingChanges(): boolean {
    return (
      this.inFlight ||
      this.coalesceAfterFlight ||
      this.debounceTimer != null ||
      (this.pendingFingerprint != null && this.pendingFingerprint !== this.lastSavedFingerprint)
    );
  }

  getStatus(): DesignAutoSaveStatus {
    if (!navigator.onLine && this.hasPendingChanges()) return "offline";
    if (this.inFlight) return "saving";
    if (this.coalesceAfterFlight || this.debounceTimer != null) return "pending";
    if (this.pendingFingerprint && this.pendingFingerprint !== this.lastSavedFingerprint) {
      return "pending";
    }
    if (this.lastSavedFingerprint) return "saved";
    return "idle";
  }

  schedule(
    fingerprint: string,
    visualFingerprint: string,
    build: DesignAutoSaveBuildFn,
  ): void {
    if (this.paused) return;
    if (fingerprint === this.lastSavedFingerprint) {
      this.pendingFingerprint = null;
      this.pendingBuild = null;
      this.coalesceAfterFlight = false;
      this.clearDebounce();
      if (!this.inFlight) this.onStatus(this.lastSavedFingerprint ? "saved" : "idle");
      return;
    }

    this.pendingFingerprint = fingerprint;
    this.pendingVisualFingerprint = visualFingerprint;
    this.pendingBuild = build;
    this.onStatus("pending");
    this.onDraftChange?.({ fingerprint, visualFingerprint, build });

    this.armDebounce();
  }

  async flush(): Promise<SavedDesignSummary | null> {
    this.clearDebounce();
    return this.runSave(true);
  }

  destroy(): void {
    this.clearDebounce();
    this.pendingBuild = null;
    this.pendingFingerprint = null;
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private async runSave(force = false): Promise<SavedDesignSummary | null> {
    if (this.paused) return null;

    if (this.inFlight) {
      this.coalesceAfterFlight = true;
      return null;
    }

    const fingerprint = this.pendingFingerprint;
    const build = this.pendingBuild;
    if (!fingerprint || !build) return null;
    if (!force && fingerprint === this.lastSavedFingerprint) {
      this.onStatus("saved");
      return null;
    }

    if (!navigator.onLine) {
      this.onStatus("offline");
      return null;
    }

    const includeThumbnail =
      this.pendingVisualFingerprint != null &&
      this.pendingVisualFingerprint !== this.lastThumbnailFingerprint;

    const request = await Promise.resolve(build({ includeThumbnail }));
    if (!request) return null;

    this.inFlight = true;
    this.onStatus("saving");

    try {
      const saved = await this.save(request, {
        designId: this.getDesignId() ?? undefined,
        silent: true,
      });
      if (saved) {
        this.lastSavedFingerprint = fingerprint;
        if (includeThumbnail && this.pendingVisualFingerprint) {
          this.lastThumbnailFingerprint = this.pendingVisualFingerprint;
        }
        // Only clear pending if nothing newer arrived during the in-flight save.
        if (this.pendingFingerprint === fingerprint) {
          this.pendingFingerprint = null;
          this.pendingBuild = null;
        }
        this.onSaved?.(saved);
        this.onStatus("saved");
        return saved;
      }
      this.onStatus("error");
      return null;
    } catch {
      this.onStatus("error");
      return null;
    } finally {
      this.inFlight = false;
      if (this.coalesceAfterFlight) {
        this.coalesceAfterFlight = false;
        if (this.pendingFingerprint && this.pendingFingerprint !== this.lastSavedFingerprint) {
          if (this.mode === "autosave" || force) {
            void this.runSave(force);
          } else {
            this.onStatus("pending");
          }
        }
      }
    }
  }
}
