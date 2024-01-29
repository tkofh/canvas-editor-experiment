<template>
  <div class="editor">
    <EditorViewport :width="1600" :height="900" content-fit="cover">
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
  </div>
</template>
