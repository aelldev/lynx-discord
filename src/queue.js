const config = require('./config');

class Semaphore {
  constructor(max) {
    this.max = max;
    this.active = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.queue.length >= config.MAX_QUEUE_SIZE) {
      throw new Error('queue-full');
    }
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release() {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }

  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  stats() {
    return { active: this.active, queued: this.queue.length, max: this.max };
  }
}

const ocrSemaphore = new Semaphore(config.MAX_CONCURRENT_OCR || 4);

let dropped = 0;

module.exports = {
  ocrSemaphore,
  trackDropped() { dropped++; },
  getDropped() { return dropped; },
};
