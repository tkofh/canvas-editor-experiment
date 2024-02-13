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
    maxBounds?: number | { x: number; y: number }
    // overscrollElasticity?: number
  }>(),
  {
    contentFit: 'cover',
    origin: 0.5,
    scrollSensitivity: 1,
    minZoom: 1,
    initialZoom: 1,
    maxZoom: 5,
    maxBounds: 1,
    // overscrollElasticity: 1,
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
watch(
  [minZoom, () => props.maxZoom],
  ([minZoom, maxZoom]) => {
    targetZoom.value = clamp(targetZoom.value, minZoom, maxZoom)
  },
  { flush: 'sync' },
)

const interactionSpringConfig = {
  friction: 10,
  mass: 0.05,
  tension: 500,
} as const

// const overpanSpringConfig = {
//   friction: 400,
//   mass: 15,
//   tension: 3000,
// } as const

const { current: currentZoom, state: zoomState } = useSpring(
  targetZoom,
  interactionSpringConfig,
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
    (Math.max(
      contentWidth.value *
        (typeof props.maxBounds === 'object'
          ? props.maxBounds.x
          : props.maxBounds) -
        intrinsicViewportWidth.value,
      0,
    ) +
      (intrinsicViewportWidth.value - viewportWidth.value)) /
    intrinsicViewportWidth.value,
)
const maxPanY = computed(
  () =>
    (Math.max(
      contentHeight.value *
        (typeof props.maxBounds === 'object'
          ? props.maxBounds.y
          : props.maxBounds) -
        intrinsicViewportHeight.value,
      0,
    ) +
      (intrinsicViewportHeight.value - viewportHeight.value)) /
    intrinsicViewportHeight.value,
)

const targetPanX = ref(0)
const targetPanY = ref(0)

watch(
  maxPanX,
  () => {
    targetPanX.value = clamp(targetPanX.value, -maxPanX.value, maxPanX.value)
  },
  { flush: 'sync' },
)
watch(
  maxPanY,
  () => {
    targetPanY.value = clamp(targetPanY.value, -maxPanY.value, maxPanY.value)
  },
  { flush: 'sync' },
)

// const { current: currentOverpanX, target: targetOverpanX } = useSpring(
//   0,
//   overpanSpringConfig,
// )
// const { current: currentOverpanY, target: targetOverpanY } = useSpring(
//   0,
//   overpanSpringConfig,
// )

const { current: currentPanX } = useSpring(targetPanX, interactionSpringConfig)
const { current: currentPanY } = useSpring(targetPanY, interactionSpringConfig)

const normalizedPointerX = ref(0)
const normalizedPointerY = ref(0)

const panXZoomAdjustment = computed(() =>
  zoomState.value === 'resting' ? 0 : targetPanX.value - currentPanX.value,
)
const panYZoomAdjustment = computed(() =>
  zoomState.value === 'resting' ? 0 : targetPanY.value - currentPanY.value,
)

watch(
  inverseZoom,
  (inverseZoom, prevInverseZoom) => {
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
  },
  { flush: 'sync' },
)

const adjustedPanX = computed(
  () => currentPanX.value + panXZoomAdjustment.value, // +
  // (targetOverpanX.value - currentOverpanX.value),
)
const adjustedPanY = computed(
  () => currentPanY.value + panYZoomAdjustment.value, // +
  // (targetOverpanY.value - currentOverpanY.value),
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

// the viewBox is the string representation of the current viewBox
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
    targetZoom.value = clamp(
      targetZoom.value + event.deltaY * deltaScrollScalar.value,
      minZoom.value,
      props.maxZoom,
    )

    normalizedPointerX.value = event.offsetX / containerWidth.value
    normalizedPointerY.value = event.offsetY / containerHeight.value
  } else {
    const updatedTargetPanX =
      targetPanX.value + event.deltaX * deltaPanScalarX.value
    const clampedPanX = clamp(updatedTargetPanX, -maxPanX.value, maxPanX.value)
    targetPanX.value = clampedPanX

    // const overpanX =
    //   (updatedTargetPanX - clampedPanX) * props.overscrollElasticity * 0.5
    // if (Math.abs(overpanX) > 0.05) {
    //   targetOverpanX.value += overpanX
    // }

    const updatedTargetPanY =
      targetPanY.value + event.deltaY * deltaPanScalarY.value
    const clampedPanY = clamp(updatedTargetPanY, -maxPanY.value, maxPanY.value)
    targetPanY.value = clampedPanY

    // const overpanY =
    //   (updatedTargetPanY - clampedPanY) * props.overscrollElasticity * 0.5
    // if (Math.abs(overpanY) > 0.05) {
    //   targetOverpanY.value += overpanY
    // }
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
