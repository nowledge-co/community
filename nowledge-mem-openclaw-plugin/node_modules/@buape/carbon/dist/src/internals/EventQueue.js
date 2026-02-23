export class EventQueue {
    client;
    queue = [];
    processing = 0;
    options;
    lastYieldAt = 0;
    // Metrics
    processedCount = 0;
    droppedCount = 0;
    timeoutCount = 0;
    constructor(client, options = {}) {
        this.client = client;
        this.options = {
            maxQueueSize: options.maxQueueSize ?? 10000,
            maxConcurrency: options.maxConcurrency ?? 50,
            listenerTimeout: options.listenerTimeout ?? 30000,
            listenerConcurrency: options.listenerConcurrency ?? 10,
            yieldIntervalMs: options.yieldIntervalMs ?? 0,
            logSlowListeners: options.logSlowListeners ?? true,
            slowListenerThreshold: options.slowListenerThreshold ?? 1000
        };
    }
    enqueue(payload, type) {
        if (this.queue.length >= this.options.maxQueueSize) {
            this.droppedCount++;
            return false;
        }
        this.queue.push({
            payload,
            type,
            timestamp: Date.now()
        });
        this.processNext();
        return true;
    }
    async processNext() {
        if (this.processing >= this.options.maxConcurrency ||
            this.queue.length === 0) {
            return;
        }
        const event = this.queue.shift();
        if (!event)
            return;
        this.processing++;
        this.processEvent(event)
            .catch((error) => {
            console.error("[EventQueue] Unexpected error processing event:", error);
        })
            .finally(() => {
            this.processing--;
            this.processedCount++;
            if (this.queue.length > 0) {
                this.processNext();
            }
        });
    }
    async processEvent(event) {
        const listeners = this.client.listeners.filter((x) => x.type === event.type);
        const concurrency = this.options.listenerConcurrency <= 0
            ? listeners.length
            : this.options.listenerConcurrency;
        let index = 0;
        const runNext = async () => {
            while (index < listeners.length) {
                const listener = listeners[index++];
                if (!listener)
                    continue;
                await this.maybeYield();
                await this.processListener(listener, event);
            }
        };
        const workers = Array.from({ length: Math.min(concurrency, listeners.length) }, () => runNext());
        await Promise.allSettled(workers);
    }
    async processListener(listener, event) {
        const startTime = Date.now();
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Listener timeout after ${this.options.listenerTimeout}ms`));
                }, this.options.listenerTimeout);
            });
            const data = listener.parseRawData(event.payload, this.client);
            await Promise.race([
                listener.handle({ ...data, clientId: event.payload.clientId }, this.client),
                timeoutPromise
            ]);
            const duration = Date.now() - startTime;
            if (this.options.logSlowListeners &&
                duration >= this.options.slowListenerThreshold) {
                console.warn(`[EventQueue] Slow listener detected: ${listener.constructor.name} took ${duration}ms for event ${String(event.type)}`);
            }
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("timeout")) {
                this.timeoutCount++;
                console.error(`[EventQueue] Listener ${listener.constructor.name} timed out after ${this.options.listenerTimeout}ms for event ${String(event.type)}`);
            }
            else {
                console.error(`[EventQueue] Listener ${listener.constructor.name} failed for event ${String(event.type)}:`, error);
            }
        }
    }
    async maybeYield() {
        if (this.options.yieldIntervalMs <= 0)
            return;
        const now = Date.now();
        if (now - this.lastYieldAt >= this.options.yieldIntervalMs) {
            this.lastYieldAt = now;
            await new Promise((resolve) => setImmediate(resolve));
        }
    }
    getMetrics() {
        return {
            queueSize: this.queue.length,
            processing: this.processing,
            processed: this.processedCount,
            dropped: this.droppedCount,
            timeouts: this.timeoutCount,
            maxQueueSize: this.options.maxQueueSize,
            maxConcurrency: this.options.maxConcurrency
        };
    }
    hasCapacity() {
        return this.queue.length < this.options.maxQueueSize;
    }
    getUtilization() {
        return this.queue.length / this.options.maxQueueSize;
    }
}
//# sourceMappingURL=EventQueue.js.map