import { sanitizeProgress, mergeProgress } from "./world.js";
export const SAVE_KEY = "lizards-kingdom-save-v1";
function readLocal() {
  try {
    return sanitizeProgress(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {
    return null;
  }
}
export class SaveStore {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.pending = false;
    this.saving = false;
    this.cloud = false;
    this.value = sanitizeProgress({});
    this.value = readLocal() || this.value;
  }
  async connect() {
    try {
      const response = await fetch("/api/progress", {
        credentials: "same-origin",
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) throw new Error("offline");
      const result = await response.json();
      if (!result.configured) throw new Error("offline");
      this.cloud = true;
      this.value = mergeProgress(this.value, result.progress);
      this.persist();
      this.onStatus("Облако подключено");
      await this.flush();
    } catch {
      this.onStatus("Сохранено на устройстве");
    }
    return this.value;
  }
  persist() {
    const stored = readLocal();
    if (stored && stored.resetAt > this.value.resetAt) this.value = stored;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.value));
    } catch {
      this.onStatus("Память устройства недоступна");
    }
  }
  update(value) {
    const stored = readLocal();
    if (stored && stored.resetAt > this.value.resetAt) this.value = stored;
    if ((value.resetAt || 0) < this.value.resetAt) return this.value;
    this.value = sanitizeProgress({
      ...value,
      updatedAt: Math.max(Date.now(), this.value.updatedAt + 1),
    });
    this.persist();
    this.pending = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 800);
    return this.value;
  }
  reset() {
    const stored = readLocal();
    const resetAt = Math.max(
      Date.now(),
      this.value.resetAt + 1,
      (stored?.resetAt || 0) + 1,
    );
    this.value = sanitizeProgress({
      hero: this.value.hero,
      mode: this.value.mode,
      resetAt,
      updatedAt: resetAt,
    });
    this.persist();
    this.pending = true;
    clearTimeout(this.timer);
    this.onStatus("Прогресс сброшен на устройстве");
    void this.flush();
    return this.value;
  }
  async flush() {
    if (!this.cloud || this.saving) return;
    this.saving = true;
    this.pending = false;
    let failed = false;
    try {
      const response = await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(this.value),
        keepalive: true,
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error("offline");
      this.onStatus("Сохранено в облаке");
    } catch {
      failed = true;
      this.pending = true;
      this.onStatus("Сохранено на устройстве · облако недоступно");
    } finally {
      this.saving = false;
      if (this.pending) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), failed ? 15000 : 0);
      }
    }
  }
}
