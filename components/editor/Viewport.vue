<script lang="ts" setup>
import { clamp, lerp, remap, roundTo } from 'micro-math'
import { useSpring } from '@coily/vue'

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    contentFit?: 'cover' | 'contain'
    origin?: number | { x: number; y: number }
    scrollSensitivity?: number
    minZoom?: number
    initialZoom?: number
    maxZoom?: number
  }>(),
  {
    contentFit: 'cover',
    origin: 0.5,
    scrollSensitivity: 1,
    minZoom: 1,
    initialZoom: 1,
    maxZoom: 5,
  },
)

const hidden = ref(true)
onMounted(() => (hidden.value = false))

const container = ref<HTMLDivElement | null>(null)
const { width: containerWidth, height: containerHeight } = useElementSize(
  container,
  { width: 1, height: 1 }, // ensures we never divide by zero
)

const contentWidth = computed(() => props.width ?? containerWidth.value)
const contentHeight = computed(() => props.height ?? containerHeight.value)

const containerScaleFactor = computed(() => {
  const widthScaleFactor = contentWidth.value / containerWidth.value
  const heightScaleFactor = contentHeight.value / containerHeight.value

  return props.contentFit === 'contain'
    ? Math.max(widthScaleFactor, heightScaleFactor)
    : Math.min(widthScaleFactor, heightScaleFactor)
})

const intrinsicViewportWidth = computed(
  () => containerWidth.value * containerScaleFactor.value,
)
const intrinsicViewportHeight = computed(
  () => containerHeight.value * containerScaleFactor.value,
)

const minZoom = computed(() => Math.max(props.minZoom, 0.001))

const targetZoom = ref(props.initialZoom)

watchEffect(
  () => {
    targetZoom.value = clamp(targetZoom.value, minZoom.value, props.maxZoom)
  },
  { flush: 'sync' },
)

const springConfig = {
  friction: 10,
  mass: 0.05,
  tension: 400,
} as const

const { current: currentZoom, state: zoomState } = useSpring(
  targetZoom,
  springConfig,
)

const inverseZoom = computed(() => 1 / currentZoom.value)

const viewportWidth = computed(
  () => intrinsicViewportWidth.value * inverseZoom.value,
)
const viewportHeight = computed(
  () => intrinsicViewportHeight.value * inverseZoom.value,
)

const maxPanX = computed(
  () =>
    (Math.max(contentWidth.value - intrinsicViewportWidth.value, 0) +
      (intrinsicViewportWidth.value - viewportWidth.value)) /
    intrinsicViewportWidth.value,
)
const maxPanY = computed(
  () =>
    (Math.max(contentHeight.value - intrinsicViewportHeight.value, 0) +
      (intrinsicViewportHeight.value - viewportHeight.value)) /
    intrinsicViewportHeight.value,
)

const targetPanX = ref(0)
const targetPanY = ref(0)

watchEffect(
  () => {
    targetPanX.value = clamp(targetPanX.value, -maxPanX.value, maxPanX.value)
  },
  { flush: 'sync' },
)

watchEffect(
  () => {
    targetPanY.value = clamp(targetPanY.value, -maxPanY.value, maxPanY.value)
  },
  { flush: 'sync' },
)

const { current: currentPanX } = useSpring(targetPanX, springConfig)
const { current: currentPanY } = useSpring(targetPanY, springConfig)

const normalizedPointerX = ref(0)
const normalizedPointerY = ref(0)

const panXZoomAdjustment = computed(() =>
  zoomState.value === 'resting' ? 0 : targetPanX.value - currentPanX.value,
)
const panYZoomAdjustment = computed(() =>
  zoomState.value === 'resting' ? 0 : targetPanY.value - currentPanY.value,
)

watch(inverseZoom, (inverseZoom, prevInverseZoom) => {
  const deltaInverseZoom = prevInverseZoom - inverseZoom
  targetPanX.value += lerp(
    normalizedPointerX.value,
    -deltaInverseZoom,
    deltaInverseZoom,
  )
  targetPanY.value += lerp(
    normalizedPointerY.value,
    -deltaInverseZoom,
    deltaInverseZoom,
  )
})

const adjustedPanX = computed(() =>
  clamp(
    currentPanX.value + panXZoomAdjustment.value,
    -maxPanX.value,
    maxPanX.value,
  ),
)
const adjustedPanY = computed(() =>
  clamp(
    currentPanY.value + panYZoomAdjustment.value,
    -maxPanY.value,
    maxPanY.value,
  ),
)

const originX = computed(() =>
  typeof props.origin === 'object' ? props.origin.x : props.origin,
)
const originY = computed(() =>
  typeof props.origin === 'object' ? props.origin.y : props.origin,
)
const viewportOriginX = computed(
  () =>
    intrinsicViewportWidth.value * originX.value +
    (contentWidth.value - intrinsicViewportWidth.value) * 0.5,
)
const viewportOriginY = computed(
  () =>
    intrinsicViewportHeight.value * originY.value +
    (contentHeight.value - intrinsicViewportHeight.value) * 0.5,
)

const viewBoxCenterX = computed(
  () => adjustedPanX.value * intrinsicViewportWidth.value * 0.5,
)
const viewBoxCenterY = computed(
  () => adjustedPanY.value * intrinsicViewportHeight.value * 0.5,
)

// the viewBox is the string representation of the current viewbox
const viewBox = computed(() => {
  const viewBoxX =
    viewportOriginX.value + viewBoxCenterX.value - viewportWidth.value * 0.5
  const viewBoxY =
    viewportOriginY.value + viewBoxCenterY.value - viewportHeight.value * 0.5

  return `${roundTo(viewBoxX, 4)} ${roundTo(viewBoxY, 4)} ${roundTo(viewportWidth.value, 4)} ${roundTo(viewportHeight.value, 4)}`
})

const inverseViewBoxAspectRatio = computed(
  () => intrinsicViewportHeight.value / intrinsicViewportWidth.value,
)

const deltaScrollScalar = computed(() => {
  const range = props.maxZoom - minZoom.value
  return (
    remap(currentZoom.value, minZoom.value, props.maxZoom, 1, range) * -0.0075
  )
})
const deltaPanScalarX = computed(
  () =>
    0.001 *
    props.scrollSensitivity *
    inverseZoom.value *
    inverseViewBoxAspectRatio.value,
)
const deltaPanScalarY = computed(
  () => 0.001 * props.scrollSensitivity * inverseZoom.value,
)

function wheelHandler(event: WheelEvent) {
  event.preventDefault()

  if (event.ctrlKey) {
    targetZoom.value = targetZoom.value + event.deltaY * deltaScrollScalar.value

    normalizedPointerX.value = event.offsetX / containerWidth.value
    normalizedPointerY.value = event.offsetY / containerHeight.value
  } else {
    targetPanX.value = targetPanX.value + event.deltaX * deltaPanScalarX.value

    targetPanY.value = targetPanY.value + event.deltaY * deltaPanScalarY.value
  }
}
</script>

<template>
  <div
    ref="container"
    style="inline-size: 100%; block-size: 100%"
    :style="{ opacity: hidden ? 0 : 1 }"
  >
    <svg
      :viewBox="viewBox"
      preserveAspectRatio="none"
      style="inline-size: 100%; block-size: 100%"
      @wheel="wheelHandler"
    >
      <slot />
    </svg>
  </div>
</template>
