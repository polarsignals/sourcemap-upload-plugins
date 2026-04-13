import type { UploadResult } from './debuginfo-uploader';

/**
 * Renders a sticky progress line at the bottom of the terminal that updates
 * in place as items complete. Verbose logs from `console.log` continue to
 * scroll above it; the line is cleared, the log is printed, then the line
 * is redrawn. No-op when stdout is not a TTY (CI/piped output).
 */
export class StickyProgress {
  private current = 0;
  private uploaded = 0;
  private skipped = 0;
  private failed = 0;
  private startTime = 0;
  private readonly total: number;
  private readonly enabled: boolean;
  private readonly label?: string;
  private originalLog: typeof console.log | null = null;

  constructor(total: number, label?: string) {
    this.total = total;
    this.label = label;
    this.enabled = process.stdout.isTTY === true && total > 0;
  }

  start(): void {
    if (!this.enabled) return;
    this.startTime = Date.now();
    this.originalLog = console.log.bind(console);
    console.log = (...args: unknown[]) => {
      this.clearLine();
      this.originalLog!(...args);
      this.drawLine();
    };
    this.drawLine();
  }

  recordResult(result: UploadResult): void {
    if (!this.enabled) return;
    this.current++;
    if (result.success) {
      if (result.skipped) this.skipped++;
      else this.uploaded++;
    } else {
      this.failed++;
    }
    this.drawLine();
  }

  done(): void {
    if (!this.enabled) return;
    this.clearLine();
    if (this.originalLog) {
      console.log = this.originalLog;
      this.originalLog = null;
    }
  }

  private clearLine(): void {
    process.stdout.write('\r\x1b[K');
  }

  private drawLine(): void {
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const rate = elapsedSec > 0 ? (this.current / elapsedSec).toFixed(1) : '0.0';
    const prefix = this.label ? `(${this.label}) ` : '';
    process.stdout.write(
      `\r${prefix}[${this.current}/${this.total}] ${rate} files/s — uploaded: ${this.uploaded}, skipped: ${this.skipped}, failed: ${this.failed}`
    );
  }
}
