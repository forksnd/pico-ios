<template>
  <div
    class="min-h-screen w-full bg-oled-dark text-white p-6 pt-16 overflow-y-auto no-scrollbar"
  >
    <!-- header -->
    <div class="flex items-center gap-4 mb-8">
      <button
        @click="$router.back()"
        class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20 transition-all"
        :class="{ 'ring-2 ring-purple-500 bg-white/20': headerFocused }"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6 text-white/80"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
      <h1
        class="font-pico-crisp text-white drop-shadow-md text-[clamp(1.5rem,5vw,3rem)]"
      >
        Input
      </h1>
    </div>

    <!-- Dialog -->
    <div
      v-if="showDialog"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <div class="bg-oled-dark p-6 rounded-xl w-80 border border-white/10">
        <h2 class="text-sm font-bold mb-3">Key already bound</h2>

        <p class="text-xs text-white/60 mb-6 whitespace-pre-line">
          {{ dialogMessage }}
        </p>

        <div class="flex gap-2 justify-end">
          <button
            @click="showDialog = false"
            class="px-3 py-1 bg-white/10 rounded"
          >
            Cancel
          </button>

          <button
            @click="replaceBinding"
            class="px-3 py-1 bg-red-500/20 text-red-400 rounded"
          >
            Replace
          </button>

          <button
            @click="addBinding"
            class="px-3 py-1 bg-purple-500 text-white rounded"
          >
            Add
          </button>
        </div>
      </div>
    </div>

    <!-- Listening overlay -->
    <div
      v-if="isListening()"
      class="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
    >
      <div
        class="bg-white/10 border border-white/20 rounded-xl p-6 text-center"
      >
        <p class="text-lg font-medium mb-2">Press a key…</p>
        <p class="text-xs text-white/50">
          (Timeout {{ listenRemaining }} seconds)
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="space-y-4 max-w-xl mx-auto">
      <div
        v-for="(action, index) in actions"
        :key="action.id"
        :ref="(el) => setItemRef(el, index)"

        class="p-4 bg-white/5 rounded-xl border border-white/10"
        :class="{
          '!bg-white/20 !border-white/40 ring-2 ring-white/50 scale-[1.02]':
            focusedIndex === index,
        }"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="font-medium">{{ action.name }}</span>

          <button
            @click="startListening(action.bit)"
            class="text-xs px-3 py-1 rounded bg-purple-500/20 text-purple-300 active:bg-purple-500/30"
          >
            Bind
          </button>
        </div>

        <!-- Bound keys -->
        <div class="flex flex-wrap gap-2">
          <template v-if="getActionBindings(action.bit).length">
            <div
              v-for="[code] in getActionBindings(action.bit)"
              :key="code"
              class="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-sm"
            >
              <span class="font-mono">{{ code }}</span>
              <button
                @click="removeBinding(code, action.bit)"
                class="text-white/40 hover:text-red-400"
              >
                ✕
              </button>
            </div>
          </template>

          <span v-else class="text-xs text-white/40"> No bindings </span>
        </div>
      </div>
    </div>

    <!-- Reset to defaults -->
    <div class="mt-10 max-w-xl mx-auto">
      <button
        @click="reset"
        class="w-full flex items-center justify-center gap-2 p-4 bg-red-500/10 border border-red-500/30 text-red-400 font-medium rounded-xl active:bg-red-500/20 transition-all"
      >
        Restore defaults
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useLibraryStore } from "../stores/library";
import { PicoButton } from "../services/InputManager";
import { inputManager } from "../services/InputManager";
import { useRouter } from "vue-router";
import { useFocusable } from "../composables/useFocusable";

const store = useLibraryStore();
const headerFocused = ref(false);
const router = useRouter();
const actions = [
  { id: "left", name: "Left", bit: PicoButton.LEFT },
  { id: "right", name: "Right", bit: PicoButton.RIGHT },
  { id: "up", name: "Up", bit: PicoButton.UP },
  { id: "down", name: "Down", bit: PicoButton.DOWN },
  { id: "o", name: "Button O", bit: PicoButton.O },
  { id: "x", name: "Button X", bit: PicoButton.X },
  { id: "pause", name: "Pause", bit: PicoButton.PAUSE },
];

const listeningFor = ref(null); // bit or null
let listenTimeout = null;
let listenInterval = null;
const listenRemaining = ref(0);
const LISTEN_DURATION = 3_000; // ms
const showDialog = ref(false);
const dialogMessage = ref("");
const pendingCode = ref("");

const startListening = (bit) => {
  stopListening();

  listeningFor.value = bit;
  const start = performance.now();
  listenRemaining.value = (LISTEN_DURATION / 1000).toFixed(1);

  listenInterval = setInterval(() => {
    const elapsed = performance.now() - start;
    const left = Math.max(0, LISTEN_DURATION - elapsed);
    listenRemaining.value = (left / 1000).toFixed(1);
  }, 100); // 0.1s resolution

  listenTimeout = setTimeout(() => {
    stopListening();
  }, LISTEN_DURATION);
};

const stopListening = () => {
  listenRemaining.value = 0;

  if (listenTimeout) {
    clearTimeout(listenTimeout);
    listenTimeout = null;
  }

  if (listenInterval) {
    clearInterval(listenInterval);
    listenInterval = null;
  }
};

const onKeyDown = (e) => {
  if (!isListening()) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  if (!e.isTrusted || e.repeat) return;

  const actions = store.getKeyBindings(e.code);

  if (actions?.length != 0) {
    pendingCode.value = e.code;
    dialogMessage.value = `"${e.code}" is already bound to:\n${actions.join(
      ", "
    )}\n\nWhat would you like to do?`;

    showDialog.value = true;
  } else {
    store.bindKey(e.code, listeningFor.value);
  }

  stopListening();
};

// focusable
const { focusedIndex, setItemRef } = useFocusable({
  items: actions,
  onSelect: (item) => startListening(item.bit),
  onBack: () => router.back(),
});

const listenerCleanup = ref(null);

onMounted(() => {
  window.addEventListener("keydown", onKeyDown, true);
  listenerCleanup.value = inputManager.addListener((action) => {
    if (action === "back") {
      router.back();
    } else if (action === "menu") {
      router.back();
    }
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeyDown, true);
  if (listenerCleanup.value) listenerCleanup.value();
});

const getActionBindings = (bit) => {
  return store.getActionBindings(bit);
};

const removeBinding = (code, bit) => {
  store.unbindKey(code, bit);
};

const replaceBinding = () => {
  store.bindKey(pendingCode.value, listeningFor.value);
  showDialog.value = false;
};

const addBinding = () => {
  store.bindKey(pendingCode.value, listeningFor.value, { append: true });
  showDialog.value = false;
};

const isListening = () => {
  return listenRemaining.value != 0;
};

const reset = () => {
  if (
    confirm(
      "DANGER: This will reset input bindings to the defaults. Are you sure?"
    )
  ) {
    store.resetKeymap();
  }
};
</script>
