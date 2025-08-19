# Node-Cycle
> High Precision Adaptive Timer for Node.js

> [!TIP]
> How to bypass event loop delays?  
> The loop itself bypasses and takes into account event loop delays, but I highly recommend using `custom.step` and dynamically changing the loop time there.

## 🧪 Tested For
- ✅ Discord UDP/RTP VoIP streams
- ✅ Real-world drift: `~0.05ms`
- ✅ FFmpeg filter loops (EQ, tempo, pitch, etc.)

---
## 🚀 Features

- 📏 **Sub-millisecond drift correction** using `performance.now()` + `Date.now`
- 🔁 **Stable timing** even under event loop pressure
- 🎯 **Self-correcting loop** with zero-delay recovery
- 🧠 **No native bindings**, 100% JavaScript
- ♻️ **Auto garbage collection** after cycle completes
- 🧩 **Extremely modular** — plug into your own system (`TaskCycle`)
---


### How to use
```ts
import { TaskCycle } from 'snpk-cycle';

const cycles = new class LowerCycle<T extends any> extends TaskCycle<T> {
    public constructor() {
        super({
            // Time until next cycle run
            duration: 20,
            
            // If dot not need drifting in cycle
            drift: false,
            
            // Custom functions (if you want to change the execution logic a little)
            custom: {},

            // Check function
            filter: (item: T) => true,

            // Execution of the function after the specified time, taking into account the filter
            execute: (item: T) => {
                // Your code
            }
        });
    };
};

// Adding your object
cycles.add(item);
```