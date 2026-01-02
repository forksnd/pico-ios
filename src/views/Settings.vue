<template>
  <div
    class="h-screen w-screen overflow-y-auto bg-oled-dark text-white p-6 pt-16"
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
      <h1 class="text-3xl font-pico-crisp text-white drop-shadow-md">
        Settings
      </h1>
    </div>

    <div class="space-y-8 max-w-2xl mx-auto">
      <section>
        <div class="space-y-3">
          <div
            v-for="(item, index) in settingsItems"
            :key="item.id"
            :ref="(el) => setItemRef(el, index)"
            @click="item.action"
            class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 active:bg-white/10 transition-all cursor-pointer select-none"
            :class="{
              '!bg-white/20 !border-white/40 ring-2 ring-white/50 scale-[1.02]':
                focusedIndex === index,
            }"
          >
            <div class="flex flex-col">
              <span class="text-white font-medium">{{ item.label }}</span>
              <span v-if="item.subtext" class="text-xs text-white/40 mt-1">{{
                item.subtext
              }}</span>
            </div>

            <!-- virtual joystick -->
            <div
              v-if="item.type === 'toggle'"
              class="w-12 h-7 rounded-full transition-colors relative"
              :class="item.value ? 'bg-purple-500' : 'bg-white/10'"
            >
              <div
                class="absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm"
                :class="item.value ? 'translate-x-5' : 'translate-x-0'"
              ></div>
            </div>

            <div
              v-else-if="item.type === 'link'"
              class="flex items-center text-white/30"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <!-- app info -->
      <section class="pt-8 flex flex-col items-center opacity-30">
        <p class="text-[10px] font-mono uppercase tracking-widest">
          Pocket8 v1.6
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useLibraryStore } from "../stores/library";
import { storeToRefs } from "pinia";
import { haptics } from "../utils/haptics";
import { ImpactStyle } from "@capacitor/haptics";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { ScopedStorage } from "@daniele-rolli/capacitor-scoped-storage";
import { Capacitor } from "@capacitor/core";
import { useGamepadGrid } from "../composables/useGamepadGrid";

import { useToast } from "../composables/useToast";

const router = useRouter();
const { showToast } = useToast();
const libraryStore = useLibraryStore();
const { swapButtons, useJoystick, hapticsEnabled, fullscreen, rootDir } =
  storeToRefs(libraryStore);
const {
  toggleSwapButtons,
  toggleJoystick,
  toggleHaptics,
  toggleFullscreen,
  updateRootDirectory,
} = libraryStore;

const currentRootDir = computed(() => {
  // check for JSON folder object
  if (rootDir.value && rootDir.value.startsWith("{")) {
    const savedName = localStorage.getItem("pico_root_name");
    if (savedName) return savedName;
    try {
      const folder = JSON.parse(rootDir.value);
      return folder.name || "External Folder";
    } catch (e) {}
  }
  // content:// URI format
  if (rootDir.value && rootDir.value.startsWith("content://")) {
    const savedName = localStorage.getItem("pico_root_name");
    if (savedName) return savedName;
    return "External Storage";
  }
  return rootDir.value || "Default";
});
const isAndroid = computed(() => Capacitor.getPlatform() === "android");

async function pickAndroidDirectory() {
  haptics.impact(ImpactStyle.Light).catch(() => {});
  try {
    const result = await ScopedStorage.pickFolder();

    console.log(
      "[Settings] ScopedStorage.pickFolder() returned:",
      JSON.stringify(result, null, 2)
    );
    const folderObj = result?.folder;

    if (!folderObj || !folderObj.id) {
      console.error("[Settings] Failed to extract folder from:", result);
      alert("Failed to get folder from picker. Please try again.");
      return;
    }

    const folderName = folderObj.name || "External Folder";

    console.log(
      "[Settings] Folder object:",
      JSON.stringify(folderObj, null, 2)
    );

    if (
      confirm(
        `Set library directory to '${folderName}'?\n(App will reload library from this location)`
      )
    ) {
      localStorage.setItem("pico_root_name", folderName);

      await updateRootDirectory(JSON.stringify(folderObj));

      await libraryStore.loadLibrary();
      haptics.success().catch(() => {});
    }
  } catch (e) {
    console.error("[Settings] pickAndroidDirectory error:", e);
    if (e.message !== "User cancelled") {
      alert("Failed to pick directory: " + e.message);
    }
  }
}

const settingsItems = computed(() => {
  const items = [
    {
      id: "swap",
      label: "Swap Action Buttons",
      type: "toggle",
      value: swapButtons.value,
      action: toggleSwapButtons,
    },
    {
      id: "joystick",
      label: "Enable Virtual Joystick",
      type: "toggle",
      value: useJoystick.value,
      action: toggleJoystick,
    },
    {
      id: "fullscreen",
      label: "Fullscreen Mode",
      subtext: "Hide on-screen controls (Ghost button)",
      type: "toggle",
      value: fullscreen.value,
      action: toggleFullscreen,
    },
    {
      id: "haptics",
      label: "Haptics",
      type: "toggle",
      value: hapticsEnabled.value,
      action: toggleHaptics,
    },
  ];

  if (isAndroid.value) {
    items.unshift({
      id: "library",
      label: "Library Directory",
      subtext: currentRootDir.value
        ? `Current: ${currentRootDir.value}`
        : "No directory selected",
      type: "link",
      action: pickAndroidDirectory,
    });
  }

  items.push({
    id: "rescan",
    label: "Rescan Library",
    subtext: "Refresh game list and cache",
    type: "link",
    action: handleRescan,
  });

  items.push({
    id: "saves",
    label: "Manage Saved Data",
    type: "link",
    action: () => router.push("/settings/saves"),
  });

  return items;
});

const handleRescan = async () => {
  if (confirm("Rescan library? This will refresh your game list.")) {
    showToast("Scanning...");
    await libraryStore.rescanLibrary();
    haptics.success();
    showToast("Library Updated");
  }
};

const headerFocused = ref(false);

const { focusedIndex, setItemRef } = useGamepadGrid({
  items: settingsItems,
  columns: ref(1),
  onSelect: (item) => item.action(),
  onBack: () => router.back(),
  onUpOut: () => {
    focusedIndex.value = -1;
    headerFocused.value = true;
  },
  enabled: computed(() => !headerFocused.value),
});

const handleHeaderNav = (e) => {
  if (!headerFocused.value) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    e.stopImmediatePropagation();
    headerFocused.value = false;
    focusedIndex.value = 0;
  }

  if (["Enter", " ", "z", "x", "Z", "X"].includes(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    router.back();
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleHeaderNav);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleHeaderNav);
});
</script>
