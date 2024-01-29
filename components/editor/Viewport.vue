<script lang="ts" setup>
import { clamp, lerp, remap, roundTo } from 'micro-math'

const props = withDefaults(
  defineProps<{
    width?: number
    height?: number
    contentFit?: 'cover' | 'contain'
    scrollSensitivity?: number
    minZoom?: number
    initialZoom?: number
    maxZoom?: number
  }>(),
  {
    contentFit: 'contain',
    scrollSensitivity: 1,
    minZoom: 1,
    initialZoom: 1,
    maxZoom: 5,
  },
)

const container = ref<HTMLDivElement | null>(null)

const hidden = ref(true)
onMounted(() => (hidden.value = false))

const { width: containerWidth, height: containerHeight } = useElementSize(
  container,
  { width: 1, height: 1 }, // ensures we never divide by zero
)

const contentWidth = computed(() => props.width ?? containerWidth.value)
const contentHeight = computed(() => props.height ?? containerHeight.value)

const minZoom = computed(() => Math.max(props.minZoom, 0.001))

const containerScaleFactor = computed(() => {
  const widthScaleFactor = contentWidth.value / containerWidth.value
  const heightScaleFactor = contentHeight.value / containerHeight.value

  return props.contentFit === 'contain'
    ? Math.max(widthScaleFactor, heightScaleFactor)
    : Math.min(widthScaleFactor, heightScaleFactor)
})

const viewBoxWidth = computed(
  () => containerWidth.value * containerScaleFactor.value,
)
const viewBoxHeight = computed(
  () => containerHeight.value * containerScaleFactor.value,
)
const inverseViewBoxAspectRatio = computed(
  () => viewBoxHeight.value / viewBoxWidth.value,
)
const shiftX = computed(() => (contentWidth.value - viewBoxWidth.value) * 0.5)
const shiftY = computed(() => (contentHeight.value - viewBoxHeight.value) * 0.5)
const halfViewBoxClippedX = computed(
  () => (contentWidth.value - viewBoxWidth.value) * 0.5,
)
const halfViewBoxClippedY = computed(
  () => (contentHeight.value - viewBoxHeight.value) * 0.5,
)
const inverseNormalizedViewBoxScrollScaleX = computed(
  () => 1 - (halfViewBoxClippedX.value * 2) / viewBoxWidth.value,
)
const inverseNormalizedViewBoxScrollScaleY = computed(
  () => 1 - (halfViewBoxClippedY.value * 2) / viewBoxHeight.value,
)

const normalizedPanX = ref(0)
const normalizedPanY = ref(0)

const zoom = ref(props.initialZoom)
watch(
  [minZoom, () => props.maxZoom],
  ([min, max]) => {
    zoom.value = clamp(zoom.value, min, max)
  },
  { immediate: true },
)

const inverseZoom = computed(() => 1 / zoom.value)
const canScrollX = computed(
  () => zoom.value > minZoom.value || halfViewBoxClippedX.value > 0,
)
const canScrollY = computed(
  () => zoom.value > minZoom.value || halfViewBoxClippedY.value > 0,
)

watch(canScrollX, (canScroll) => {
  if (!canScroll) {
    normalizedPanX.value = 0
  }
})
watch(canScrollY, (canScroll) => {
  if (!canScroll) {
    normalizedPanY.value = 0
  }
})

const viewBox = computed(() => {
  const boxWidth = viewBoxWidth.value * inverseZoom.value
  const boxHeight = viewBoxHeight.value * inverseZoom.value

  const viewX = remap(
    normalizedPanX.value,
    -1,
    1,
    -halfViewBoxClippedX.value,
    viewBoxWidth.value + halfViewBoxClippedX.value - boxWidth,
    false,
  )
  const viewY = remap(
    normalizedPanY.value,
    -1,
    1,
    -halfViewBoxClippedY.value,
    viewBoxHeight.value + halfViewBoxClippedY.value - boxHeight,
    false,
  )

  return `${roundTo(viewX + shiftX.value, 4)} ${roundTo(viewY + shiftY.value, 4)} ${roundTo(boxWidth, 4)} ${roundTo(boxHeight, 4)}`
})

const scrollZoomScalar = computed(() =>
  lerp(0.25, inverseZoom.value ** 2, inverseZoom.value),
)
const scrollScalarX = computed(() => {
  if (canScrollX.value) {
    return (
      0.0025 *
      props.scrollSensitivity *
      scrollZoomScalar.value *
      inverseNormalizedViewBoxScrollScaleX.value *
      inverseViewBoxAspectRatio.value
    )
  }

  return 0
})
const scrollScalarY = computed(() => {
  if (canScrollY.value) {
    return (
      0.0025 *
      props.scrollSensitivity *
      scrollZoomScalar.value *
      inverseNormalizedViewBoxScrollScaleY.value
    )
  }

  return 0
})

function wheelHandler(event: WheelEvent) {
  event.preventDefault()

  if (event.ctrlKey) {
    const deltaZoom = event.deltaY * -0.01
    zoom.value = clamp(zoom.value + deltaZoom, minZoom.value, props.maxZoom)

    const normalizedPointerX = remap(
      event.offsetX,
      0,
      containerWidth.value,
      -1,
      1,
    )
    const normalizedPointerY = remap(
      event.offsetY,
      0,
      containerHeight.value,
      -1,
      1,
    )

    normalizedPanX.value = clamp(
      normalizedPanX.value +
        (normalizedPointerX - normalizedPanX.value) * inverseZoom.value,
      -1,
      1,
    )
    normalizedPanY.value = clamp(
      normalizedPanY.value +
        (normalizedPointerY - normalizedPanY.value) * inverseZoom.value,
      -1,
      1,
    )
  } else {
    normalizedPanX.value = clamp(
      normalizedPanX.value + event.deltaX * scrollScalarX.value,
      -1,
      1,
    )
    normalizedPanY.value = clamp(
      normalizedPanY.value + event.deltaY * scrollScalarY.value,
      -1,
      1,
    )
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
