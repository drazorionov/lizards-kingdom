import { sanitizeProgress, mergeProgress } from "./world.js";
const KEY = "lizards-kingdom-save-v1";
export class SaveStore {
  constructor(onStatus) {
    this.onStatus = onStatus;
    this.pending = false;
    this.saving = false;
    this.cloud = false;
    this.value = sanitizeProgress({});
    try {
      this.value =
        sanitizeProgress(JSON.parse(localStorage.getItem(KEY))) || this.value;
    } catch {}
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
      this.onStatus("Cloud save connected");
      await this.flush();
    } catch {
      this.onStatus("Saved on this device");
    }
    return this.value;
  }
  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      this.onStatus("Device storage unavailable");
    }
  }
  update(value) {
    this.value = sanitizeProgress({ ...value, updatedAt: Date.now() });
    this.persist();
    this.pending = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 800);
  }
  async flush() {
    if (!this.cloud || this.saving) return;
    this.saving = true;
    this.pending = false;
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
      this.onStatus("Saved to the cloud");
    } catch {
      this.pending = true;
      this.onStatus("Saved on this device · cloud offline");
    } finally {
      this.saving = false;
      if (this.pending) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(), 15000);
      }
    }
  }
}
