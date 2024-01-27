import type { ActorSystem } from 'xstate'
import { fromTransition } from 'xstate'

/**
 * Editor
 *
 * Manages the viewport of the root <svg> element
 *
 * - The `zoom` scalar is applied to the `width` and `height` to compute the viewBox
 * - It is stored in its scalar form (i.e., 0.5 represents a 200% zoom)
 */

interface ViewportState {
  x: number
  y: number
  width: number
  height: number
  zoom: number
  viewBox: string
  maxZoom: number
}

type ViewportEvent = WheelEvent | (Event & { type: 'resize' })

interface ViewportInput {
  width: number
  height: number
  maxZoom: number
}

export const viewportLogic = fromTransition<
  ViewportState,
  ViewportEvent,
  ActorSystem<any>,
  ViewportInput
>(
  (state, event) => {
    // if (event.type === 'resize') {
    //   return state
    // } else if (event.type === 'wheel' && event.ctrlKey) {
    //   // zoom
    //   const zoom = clamp(state.zoom + event.deltaY * 0.01, 1, state.maxZoom)
    //   const delta = state.zoom - zoom
    //
    //   const x = state.x + (event.offsetX - state.x)
    //   const y = state.y + (event.offsetY - state.y)
    //
    //   return {
    //     ...state,
    //     x,
    //     y,
    //     zoom,
    //   }
    // } else if (event.type === 'wheel' && !event.ctrlKey) {
    //   return state
    // } else {
    return state
    // }
  },
  ({ input }) => ({
    x: 0,
    y: 0,
    height: input.height,
    width: input.width,
    zoom: 1,
    viewBox: '',
    maxZoom: input.maxZoom,
  }),
)
