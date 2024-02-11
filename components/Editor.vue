<script lang="ts" setup>
import { createTicker } from 'tickloop'
import { createSpringSystem } from 'coily'
import { provideSpringSystem } from '@coily/vue'

const ticker = createTicker()
const system = createSpringSystem()
ticker.add((_, delta) => {
  system.simulate(delta)
})
provideSpringSystem(system)

const debug = ref('')
const updateDebug = (e: string) => (debug.value = e)
</script>

<template>
  <div class="editor">
    <EditorViewport :width="1600" :height="900" @update-debug="updateDebug">
      <rect x="0" y="0" width="1600" height="900" fill="#eee"></rect>
      <template v-for="x in 15" :key="`x-${x}`">
        <circle
          v-for="y in 8"
          :key="`y-${y}`"
          :cx="x * 100"
          :cy="y * 100"
          r="10"
          fill="blue"
          stroke="white"
          stroke-width="5"
        >
        </circle>
      </template>
    </EditorViewport>
    <div v-if="debug !== ''" class="debug">
      <pre>{{ debug }}</pre>
    </div>
    <div class="crosshairs"></div>
  </div>
</template>

<style>
.editor {
  position: relative;
}
.debug {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #f8f8ff;
  padding: 1rem;
  z-index: 100;
}
.crosshairs {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1rem;
  height: 1rem;
  transform: translate(-50%, -50%);
  z-index: 10;
  background: red;
  border-radius: 50%;
}
</style>
