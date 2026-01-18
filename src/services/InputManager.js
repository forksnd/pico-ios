import { reactive, watch } from "vue";
import { useLibraryStore } from "../stores/library";
import { Capacitor } from "@capacitor/core";

class InputManagerService {
  constructor() {
    this.state = reactive({
      inputMode: "UI", // 'UI' | 'GAME'
      active: false,
    });

    this.listeners = new Set();
    this.loopId = null;
    this.lastButtonState = {
      menu: false,
      navUp: false,
      navDown: false,
      navLeft: false,
      navRight: false,
      confirm: false,
      back: false,
    };

    // STATIC BUFFERS
    // store frame inputs
    this._inputBuffer = {
      up: false,
      down: false,
      left: false,
      right: false,
      a: false,
      b: false,
      x: false,
      y: false,
      start: false,
      select: false,
    };

    // cached store values to avoid allocation in poll
    this.swapButtons = false;
    this.isAndroid = Capacitor.getPlatform() === "android";
    this._justSwapped = false;

    // keyboard state
    this.keys = {};
    this.boundKeyHandler = this.handleKey.bind(this);

    // pico-8 layout default (left=1, right=2, up=4, down=8, o=16, x=32)
    if (typeof window !== "undefined") {
      window.pico8_buttons = window.pico8_buttons || [0, 0, 0, 0, 0, 0, 0, 0];
    }
  }

  init() {
    if (this.loopId) return;
    this.state.active = true;

    // sync initial settings & watch for changes
    const store = useLibraryStore();
    this.swapButtons = store.swapButtons;

    // watch store for swap changes (avoids polling store in loop)
    watch(
      () => store.swapButtons,
      (newVal) => {
        const oldVal = this.swapButtons;
        this.swapButtons = newVal;
        console.log(`[input-manager] cached swapButtons updated: ${newVal}`);

        if (this.state.inputMode === "UI" && newVal !== oldVal) {
          this.lastButtonState["back"] = true;
          this.lastButtonState["confirm"] = true;
          this._justSwapped = true;
        }
      },
      { flush: "sync" }
    );

    // attach keyboard listeners
    window.addEventListener("keydown", this.boundKeyHandler);
    window.addEventListener("keyup", this.boundKeyHandler);

    this.loop();
    console.log("[input-manager] initialized (zero-latency mode)");
  }

  destroy() {
    if (this.loopId) {
      cancelAnimationFrame(this.loopId);
      this.loopId = null;
    }
    window.removeEventListener("keydown", this.boundKeyHandler);
    window.removeEventListener("keyup", this.boundKeyHandler);
    this.state.active = false;
  }

  handleKey(e) {
    this.keys[e.key] = e.type === "keydown";
  }

  // register a listener for ui events
  addListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setMode(mode) {
    if (!["UI", "GAME"].includes(mode)) return;

    this.state.inputMode = mode;

    // clear inputs when switching to avoid stuck buttons
    this.lastButtonState = {
      menu: false,
      navUp: false,
      navDown: false,
      navLeft: false,
      navRight: false,
      confirm: false,
      back: false,
    };

    // reset virtual gamepad bits
    if (mode === "UI") {
      if (window.pico8_buttons) window.pico8_buttons[0] = 0;
    }
  }

  loop = () => {
    // reset protect flag at start of new frame
    this._justSwapped = false;

    // force input flush on android
    if (this.isAndroid) {
      this.poll();
    }
    this.poll();
    this.loopId = requestAnimationFrame(this.loop);
  };

  poll() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;

    // gather raw inputs into buffer
    const buf = this._inputBuffer;

    if (gp) {
      // gamepad
      const btns = gp.buttons;
      const axes = gp.axes;

      buf.a = btns[0]?.pressed || false;
      buf.b = btns[1]?.pressed || false;
      buf.x = btns[2]?.pressed || false; // usually unused
      buf.y = btns[3]?.pressed || false; // usually unused
      buf.select = btns[8]?.pressed || false;
      buf.start = btns[9]?.pressed || false;

      // dpad / analog hybrid
      buf.up = btns[12]?.pressed || axes[1] < -0.5 || false;
      buf.down = btns[13]?.pressed || axes[1] > 0.5 || false;
      buf.left = btns[14]?.pressed || axes[0] < -0.5 || false;
      buf.right = btns[15]?.pressed || axes[0] > 0.5 || false;
    } else {
      // reset if no gamepad
      buf.a = false;
      buf.b = false;
      buf.x = false;
      buf.y = false;
      buf.select = false;
      buf.start = false;
      buf.up = false;
      buf.down = false;
      buf.left = false;
      buf.right = false;
    }

    // kb
    if (this.keys["ArrowUp"]) buf.up = true;
    if (this.keys["ArrowDown"]) buf.down = true;
    if (this.keys["ArrowLeft"]) buf.left = true;
    if (this.keys["ArrowRight"]) buf.right = true;

    // GAME MODE
    if (this.state.inputMode === "GAME") {
      let mask = 0;

      if (buf.left) mask |= 1;
      if (buf.right) mask |= 2;
      if (buf.up) mask |= 4;
      if (buf.down) mask |= 8;

      let o = false;
      let x = false;

      // map face buttons
      if (!this.swapButtons) {
        if (buf.a || buf.y) o = true;
        if (buf.b || buf.x) x = true;
        // keys
        if (
          this.keys["z"] ||
          this.keys["Z"] ||
          this.keys["c"] ||
          this.keys["C"] ||
          this.keys["n"] ||
          this.keys["N"]
        )
          o = true;
        if (
          this.keys["x"] ||
          this.keys["X"] ||
          this.keys["v"] ||
          this.keys["V"] ||
          this.keys["m"] ||
          this.keys["M"]
        )
          x = true;
      } else {
        if (buf.b || buf.x) o = true;
        if (buf.a || buf.y) x = true;
        // keys
        if (
          this.keys["x"] ||
          this.keys["X"] ||
          this.keys["v"] ||
          this.keys["V"] ||
          this.keys["m"] ||
          this.keys["M"]
        )
          o = true;
        if (
          this.keys["z"] ||
          this.keys["Z"] ||
          this.keys["c"] ||
          this.keys["C"] ||
          this.keys["n"] ||
          this.keys["N"]
        )
          x = true;
      }

      if (o) mask |= 16;
      if (x) mask |= 32;

      // handle pause/menu (start/select)
      if (
        buf.select ||
        buf.start ||
        this.keys["Escape"] ||
        this.keys["p"] ||
        this.keys["P"]
      ) {
        this.emitOnce("menu");
      } else {
        this.lastButtonState["menu"] = false;
      }

      // DIRECT INJECTION
      if (window.pico8_buttons) {
        window.pico8_buttons[0] = mask;
      }
    }
    // UI MODE
    else {
      // nav
      this.emitChange("nav-up", buf.up);
      this.emitChange("nav-down", buf.down);
      this.emitChange("nav-left", buf.left);
      this.emitChange("nav-right", buf.right);

      // confirm / back
      let confirm = false;
      let back = false;

      // gamepad face
      if (!this.swapButtons) {
        if (buf.a) confirm = true;
        if (buf.b) back = true;
      } else {
        if (buf.b) confirm = true;
        if (buf.a) back = true;
      }

      // keyboard
      if (
        this.keys["z"] ||
        this.keys["Z"] ||
        this.keys["Enter"] ||
        this.keys[" "]
      )
        confirm = true;
      if (
        this.keys["x"] ||
        this.keys["X"] ||
        this.keys["Backspace"] ||
        this.keys["Escape"]
      )
        back = true;

      this.emitChange("confirm", confirm);
      this.emitChange("back", back);
    }
  }

  emitOnce(event) {
    if (!this.lastButtonState[event]) {
      this.emit(event);
      this.lastButtonState[event] = true;
    }
  }

  emitChange(event, isPressed) {
    if (isPressed) {
      if (!this.lastButtonState[event]) {
        this.emit(event);
        this.lastButtonState[event] = true;
      }
    } else {
      // protect against clearing state if we just swapped buttons in this frame
      if (this._justSwapped && (event === "back" || event === "confirm")) {
        return;
      }
      this.lastButtonState[event] = false;
    }
  }

  emit(eventName, data = null) {
    this.listeners.forEach((listener) => listener(eventName, data));
  }

  // legacy compat
  checkKeys(keyList) {
    return false;
  }
}

export const inputManager = new InputManagerService();
