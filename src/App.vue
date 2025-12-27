<template>
  <div
    class="antialiased min-h-screen bg-gradient-to-b from-gray-900 to-black text-white selection:bg-purple-500 selection:text-white"
  >
    <!-- # global background effects -->
    <RouterView v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>

    <!-- global dynamic island toast -->
    <Transition name="slide-down">
      <div
        v-if="toast.isVisible.value"
        class="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-full shadow-2xl backdrop-blur-md border border-white/10 transition-all duration-300 !pointer-events-none"
        :class="
          toast.type.value === 'error' ? 'bg-red-500/90' : 'bg-neutral-900/90'
        "
      >
        <!-- icon based on type -->
        <span v-if="toast.type.value === 'success'" class="text-green-400"
          >✓</span
        >
        <span v-else-if="toast.type.value === 'error'" class="text-white"
          >✕</span
        >
        <span v-else class="text-blue-400">ℹ</span>

        <span
          class="text-white font-medium text-sm tracking-wide !pointer-events-auto"
          >{{ toast.message.value }}</span
        >
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { RouterView } from "vue-router";
import { useToast } from "./composables/useToast";

const toast = useToast();
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* toast slide animation */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translate(-50%, -150%);
}
</style>
