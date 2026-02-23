import * as fs from "node:fs";
import { setKittyProtocolActive } from "./keys.js";
import { StdinBuffer } from "./stdin-buffer.js";
/**
 * Real terminal using process.stdin/stdout
 */
export class ProcessTerminal {
    wasRaw = false;
    inputHandler;
    resizeHandler;
    _kittyProtocolActive = false;
    stdinBuffer;
    stdinDataHandler;
    writeLogPath = process.env.PI_TUI_WRITE_LOG || "";
    get kittyProtocolActive() {
        return this._kittyProtocolActive;
    }
    start(onInput, onResize) {
        this.inputHandler = onInput;
        this.resizeHandler = onResize;
        // Save previous state and enable raw mode
        this.wasRaw = process.stdin.isRaw || false;
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(true);
        }
        process.stdin.setEncoding("utf8");
        process.stdin.resume();
        // Enable bracketed paste mode - terminal will wrap pastes in \x1b[200~ ... \x1b[201~
        process.stdout.write("\x1b[?2004h");
        // Set up resize handler immediately
        process.stdout.on("resize", this.resizeHandler);
        // Refresh terminal dimensions - they may be stale after suspend/resume
        // (SIGWINCH is lost while process is stopped). Unix only.
        if (process.platform !== "win32") {
            process.kill(process.pid, "SIGWINCH");
        }
        // On Windows, enable ENABLE_VIRTUAL_TERMINAL_INPUT so the console sends
        // VT escape sequences (e.g. \x1b[Z for Shift+Tab) instead of raw console
        // events that lose modifier information. Must run AFTER setRawMode(true)
        // since that resets console mode flags.
        this.enableWindowsVTInput();
        // Query and enable Kitty keyboard protocol
        // The query handler intercepts input temporarily, then installs the user's handler
        // See: https://sw.kovidgoyal.net/kitty/keyboard-protocol/
        this.queryAndEnableKittyProtocol();
    }
    /**
     * Set up StdinBuffer to split batched input into individual sequences.
     * This ensures components receive single events, making matchesKey/isKeyRelease work correctly.
     *
     * Also watches for Kitty protocol response and enables it when detected.
     * This is done here (after stdinBuffer parsing) rather than on raw stdin
     * to handle the case where the response arrives split across multiple events.
     */
    setupStdinBuffer() {
        this.stdinBuffer = new StdinBuffer({ timeout: 10 });
        // Kitty protocol response pattern: \x1b[?<flags>u
        const kittyResponsePattern = /^\x1b\[\?(\d+)u$/;
        // Forward individual sequences to the input handler
        this.stdinBuffer.on("data", (sequence) => {
            // Check for Kitty protocol response (only if not already enabled)
            if (!this._kittyProtocolActive) {
                const match = sequence.match(kittyResponsePattern);
                if (match) {
                    this._kittyProtocolActive = true;
                    setKittyProtocolActive(true);
                    // Enable Kitty keyboard protocol (push flags)
                    // Flag 1 = disambiguate escape codes
                    // Flag 2 = report event types (press/repeat/release)
                    // Flag 4 = report alternate keys (shifted key, base layout key)
                    // Base layout key enables shortcuts to work with non-Latin keyboard layouts
                    process.stdout.write("\x1b[>7u");
                    return; // Don't forward protocol response to TUI
                }
            }
            if (this.inputHandler) {
                this.inputHandler(sequence);
            }
        });
        // Re-wrap paste content with bracketed paste markers for existing editor handling
        this.stdinBuffer.on("paste", (content) => {
            if (this.inputHandler) {
                this.inputHandler(`\x1b[200~${content}\x1b[201~`);
            }
        });
        // Handler that pipes stdin data through the buffer
        this.stdinDataHandler = (data) => {
            this.stdinBuffer.process(data);
        };
    }
    /**
     * Query terminal for Kitty keyboard protocol support and enable if available.
     *
     * Sends CSI ? u to query current flags. If terminal responds with CSI ? <flags> u,
     * it supports the protocol and we enable it with CSI > 1 u.
     *
     * The response is detected in setupStdinBuffer's data handler, which properly
     * handles the case where the response arrives split across multiple stdin events.
     */
    queryAndEnableKittyProtocol() {
        this.setupStdinBuffer();
        process.stdin.on("data", this.stdinDataHandler);
        process.stdout.write("\x1b[?u");
    }
    /**
     * On Windows, add ENABLE_VIRTUAL_TERMINAL_INPUT (0x0200) to the stdin
     * console handle so the terminal sends VT sequences for modified keys
     * (e.g. \x1b[Z for Shift+Tab). Without this, libuv's ReadConsoleInputW
     * discards modifier state and Shift+Tab arrives as plain \t.
     */
    enableWindowsVTInput() {
        if (process.platform !== "win32")
            return;
        try {
            // Dynamic require to avoid bundling koffi's 74MB of cross-platform
            // native binaries into every compiled binary. Koffi is only needed
            // on Windows for VT input support.
            const koffi = require("koffi");
            const k32 = koffi.load("kernel32.dll");
            const GetStdHandle = k32.func("void* __stdcall GetStdHandle(int)");
            const GetConsoleMode = k32.func("bool __stdcall GetConsoleMode(void*, _Out_ uint32_t*)");
            const SetConsoleMode = k32.func("bool __stdcall SetConsoleMode(void*, uint32_t)");
            const STD_INPUT_HANDLE = -10;
            const ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200;
            const handle = GetStdHandle(STD_INPUT_HANDLE);
            const mode = new Uint32Array(1);
            GetConsoleMode(handle, mode);
            SetConsoleMode(handle, mode[0] | ENABLE_VIRTUAL_TERMINAL_INPUT);
        }
        catch {
            // koffi not available — Shift+Tab won't be distinguishable from Tab
        }
    }
    async drainInput(maxMs = 1000, idleMs = 50) {
        if (this._kittyProtocolActive) {
            // Disable Kitty keyboard protocol first so any late key releases
            // do not generate new Kitty escape sequences.
            process.stdout.write("\x1b[<u");
            this._kittyProtocolActive = false;
            setKittyProtocolActive(false);
        }
        const previousHandler = this.inputHandler;
        this.inputHandler = undefined;
        let lastDataTime = Date.now();
        const onData = () => {
            lastDataTime = Date.now();
        };
        process.stdin.on("data", onData);
        const endTime = Date.now() + maxMs;
        try {
            while (true) {
                const now = Date.now();
                const timeLeft = endTime - now;
                if (timeLeft <= 0)
                    break;
                if (now - lastDataTime >= idleMs)
                    break;
                await new Promise((resolve) => setTimeout(resolve, Math.min(idleMs, timeLeft)));
            }
        }
        finally {
            process.stdin.removeListener("data", onData);
            this.inputHandler = previousHandler;
        }
    }
    stop() {
        // Disable bracketed paste mode
        process.stdout.write("\x1b[?2004l");
        // Disable Kitty keyboard protocol if not already done by drainInput()
        if (this._kittyProtocolActive) {
            process.stdout.write("\x1b[<u");
            this._kittyProtocolActive = false;
            setKittyProtocolActive(false);
        }
        // Clean up StdinBuffer
        if (this.stdinBuffer) {
            this.stdinBuffer.destroy();
            this.stdinBuffer = undefined;
        }
        // Remove event handlers
        if (this.stdinDataHandler) {
            process.stdin.removeListener("data", this.stdinDataHandler);
            this.stdinDataHandler = undefined;
        }
        this.inputHandler = undefined;
        if (this.resizeHandler) {
            process.stdout.removeListener("resize", this.resizeHandler);
            this.resizeHandler = undefined;
        }
        // Pause stdin to prevent any buffered input (e.g., Ctrl+D) from being
        // re-interpreted after raw mode is disabled. This fixes a race condition
        // where Ctrl+D could close the parent shell over SSH.
        process.stdin.pause();
        // Restore raw mode state
        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(this.wasRaw);
        }
    }
    write(data) {
        process.stdout.write(data);
        if (this.writeLogPath) {
            try {
                fs.appendFileSync(this.writeLogPath, data, { encoding: "utf8" });
            }
            catch {
                // Ignore logging errors
            }
        }
    }
    get columns() {
        return process.stdout.columns || 80;
    }
    get rows() {
        return process.stdout.rows || 24;
    }
    moveBy(lines) {
        if (lines > 0) {
            // Move down
            process.stdout.write(`\x1b[${lines}B`);
        }
        else if (lines < 0) {
            // Move up
            process.stdout.write(`\x1b[${-lines}A`);
        }
        // lines === 0: no movement
    }
    hideCursor() {
        process.stdout.write("\x1b[?25l");
    }
    showCursor() {
        process.stdout.write("\x1b[?25h");
    }
    clearLine() {
        process.stdout.write("\x1b[K");
    }
    clearFromCursor() {
        process.stdout.write("\x1b[J");
    }
    clearScreen() {
        process.stdout.write("\x1b[2J\x1b[H"); // Clear screen and move to home (1,1)
    }
    setTitle(title) {
        // OSC 0;title BEL - set terminal window title
        process.stdout.write(`\x1b]0;${title}\x07`);
    }
}
//# sourceMappingURL=terminal.js.map