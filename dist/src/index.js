"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromiseCycle = exports.TaskCycle = void 0;
const perf_hooks_1 = require("perf_hooks");
class BaseCycle extends Set {
    performance;
    prevEventLoopLag;
    lastDelay;
    startTime = 0;
    tickTime = 0;
    drift = 0;
    get drifting() {
        return this.drift + this.prevEventLoopLag;
    }
    ;
    get insideTime() {
        return this.startTime + this.tickTime;
    }
    ;
    get delay() {
        return this.lastDelay;
    }
    ;
    set delay(duration) {
        const expectedTime = this.startTime + this.tickTime + duration;
        const step = Math.max(1, (this.time - expectedTime) / duration);
        const timeCorrection = step * duration;
        this.tickTime += timeCorrection;
        this.lastDelay = timeCorrection;
    }
    ;
    get time() {
        return Date.now();
    }
    ;
    add(item) {
        const existing = this.has(item);
        if (existing)
            this.delete(item);
        super.add(item);
        if (this.size === 1 && this.startTime === 0) {
            this.startTime = this.time;
            setImmediate(this._stepCycle);
        }
        return this;
    }
    ;
    reset() {
        this.clear();
        this.startTime = 0;
        this.tickTime = 0;
        this.lastDelay = 0;
        this.drift = 0;
        this.performance = 0;
        this.prevEventLoopLag = 0;
    }
    ;
    _stepCheckTimeCycle = (duration) => {
        if (this.size === 0)
            return this.reset();
        this.delay = duration;
        return this._runTimeout(this.insideTime, this._stepCycle);
    };
    _stepCheckTimeCycleDrift = (duration) => {
        if (this.size === 0)
            return this.reset();
        const tickStart = this.time;
        this.delay = duration;
        const lags = this._calculateLags(this.lastDelay);
        const nextTargetTime = this.insideTime - this.drift - lags;
        this._runTimeout(nextTargetTime, () => {
            this._stepCycle();
            const tickEnd = this.time;
            this.drift = this._compensator(0.9, this.drift, tickEnd - tickStart);
        });
    };
    _runTimeout = (actualTime, callback) => {
        const delay = Math.max(0, actualTime - this.time);
        (delay < 1 ? process.nextTick : setTimeout)(callback, delay);
    };
    _calculateLags = (duration) => {
        const performanceNow = perf_hooks_1.performance.now();
        const driftEvent = this.performance ? Math.max(0, (performanceNow - this.performance) - duration) : 0;
        this.performance = performanceNow;
        return this.prevEventLoopLag = this.prevEventLoopLag !== undefined ? this._compensator(0.9, this.prevEventLoopLag, driftEvent) : driftEvent;
    };
    _compensator = (alpha, old, current) => {
        return alpha * old + (1 - alpha) * current;
    };
}
class TaskCycle extends BaseCycle {
    options;
    constructor(options) {
        super();
        this.options = options;
    }
    ;
    add = (item) => {
        if (this.options.custom?.push)
            this.options.custom?.push(item);
        else if (this.has(item))
            this.delete(item);
        super.add(item);
        return this;
    };
    delete = (item) => {
        const index = this.has(item);
        if (index) {
            if (this.options.custom?.remove)
                this.options.custom.remove(item);
            super.delete(item);
        }
        return true;
    };
    _stepCycle = async () => {
        this.options?.custom?.step?.();
        for (const item of this) {
            if (!this.options.filter(item))
                continue;
            try {
                this.options.execute(item);
            }
            catch (error) {
                this.delete(item);
                console.log(error);
            }
        }
        if (this.options.drift)
            return this._stepCheckTimeCycle(this.options.duration);
        return this._stepCheckTimeCycleDrift(this.options.duration);
    };
}
exports.TaskCycle = TaskCycle;
class PromiseCycle extends BaseCycle {
    options;
    constructor(options) {
        super();
        this.options = options;
    }
    ;
    add = (item) => {
        if (this.options.custom?.push)
            this.options.custom?.push(item);
        else if (this.has(item))
            this.delete(item);
        super.add(item);
        return this;
    };
    delete = (item) => {
        const index = this.has(item);
        if (index) {
            if (this.options.custom?.remove)
                this.options.custom.remove(item);
            super.delete(item);
        }
        return true;
    };
    _stepCycle = async () => {
        for (const item of this) {
            if (!this.options.filter(item))
                continue;
            try {
                const bool = await this.options.execute(item);
                if (!bool)
                    this.delete(item);
            }
            catch (error) {
                this.delete(item);
                console.log(error);
            }
        }
        if (this.options.drift)
            return this._stepCheckTimeCycle(30e3);
        return this._stepCheckTimeCycleDrift(30e3);
    };
}
exports.PromiseCycle = PromiseCycle;
