"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskCycle = void 0;
const ResetTime = 1000 * 60 * 60 * 2;
class BaseCycle extends Set {
    performance;
    lastDelay;
    startTime = 0;
    tickTime = 0;
    drift = 0;
    get drifting() {
        return this.drift;
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
    reset = () => {
        this.clear();
        this.startTime = 0;
        this.tickTime = 0;
        this.lastDelay = null;
        this.drift = 0;
        this.performance = null;
        setImmediate(() => {
            if (typeof global.gc === "function")
                global.gc();
        });
    };
    _stepCheckTimeCycle = (duration) => {
        if (this.size === 0)
            return this.reset();
        const actualTime = this.startTime + this.tickTime + duration;
        this.tickTime += duration;
        return this._runTimeout(duration, actualTime, this._stepCycle);
    };
    _stepCheckTimeCycleDrift = (duration) => {
        if (this.size === 0)
            return this.reset();
        const expectedNextTime = this.startTime + this.tickTime + duration;
        const correction = Math.floor((this.time - expectedNextTime) / duration);
        const driftSteps = Math.max(1, correction);
        const tickTime = driftSteps * duration;
        this.tickTime += tickTime;
        const performanceNow = performance.now();
        const eventLoopLag = this.performance
            ? Math.max(0, (performanceNow - this.performance) - (tickTime + (driftSteps / 0.5)))
            : duration;
        this.performance = performanceNow;
        const nextTargetTime = (expectedNextTime + this.drift) - eventLoopLag;
        this._runTimeout(duration, nextTargetTime, () => {
            const tickStart = this.time;
            this._stepCycle();
            const tickEnd = this.time;
            const actualStepDuration = tickEnd - tickStart;
            this.drift = Math.max(0, actualStepDuration);
        });
    };
    _runTimeout = (duration, actualTime, callback) => {
        const delay = Math.max(0, actualTime - this.time);
        if (this.tickTime >= ResetTime) {
            this.startTime = this.time;
            this.tickTime = 0;
            this.drift = 0;
            this.lastDelay = null;
        }
        if (delay <= 0) {
            if (this.lastDelay && this.lastDelay < 1) {
                this.lastDelay = duration;
                setTimeout(callback, duration);
                return;
            }
            process.nextTick(this._stepCycle);
            return;
        }
        this.lastDelay = delay;
        setTimeout(callback, delay);
    };
}
class TaskCycle extends BaseCycle {
    options;
    get time() {
        if (!this.options.drift)
            return Number(process.hrtime.bigint()) / 1e6;
        return Date.now();
    }
    ;
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
        await this.options?.custom?.step?.();
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
