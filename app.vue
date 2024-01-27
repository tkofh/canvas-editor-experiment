<script lang="ts" setup>
import { useActor } from '@xstate/vue'
import { canvasLogic } from '~/behavior/canvas'

const { snapshot, actorRef } = useActor(canvasLogic)
const send = actorRef.send

const canvas = ref<HTMLElement>()
onMounted(() => {
  if (!canvas.value) return
  send({ type: 'mount', canvas: canvas.value })
})
</script>

<template>
  <svg ref="canvas" :viewBox="snapshot.context.viewBox">
    <circle cx="500" cy="500" r="400" fill="red" />
  </svg>
</template>

<style>
svg {
  display: block;
  width: 100dvi;
  height: 100dvb;
}
</style>
