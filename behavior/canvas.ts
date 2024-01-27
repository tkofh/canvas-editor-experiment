import { assertEvent, assign, setup, fromCallback, sendTo } from 'xstate'
import type {
  ActorSystem,
  AnyEventObject,
  ActorRef,
  CallbackSnapshot,
  ExtractEvent,
} from 'xstate'
import { clamp, remap } from 'micro-math'

type CanvasEvent =
  | { type: 'mount'; canvas: HTMLElement }
  | { type: 'resize'; width: number; height: number }
  | { type: 'pan'; x: number; y: number }
  | { type: 'zoom'; amount: number }

interface CanvasContext {
  centerX: number
  centerY: number
  panX: number
  panY: number
  zoom: number
  viewBox: string
}

const canvasObserverLogic = fromCallback<
  ExtractEvent<CanvasEvent, 'mount'>,
  HTMLElement
>(({ sendBack, input }) => {
  const observer = new ResizeObserver((entries) => {
    const { width, height } = entries[0].contentRect
    sendBack({ type: 'resize', width, height })
  })
  observer.observe(input)

  const handler = (event: WheelEvent) => {
    event.preventDefault()

    if (event.ctrlKey) {
      const amount = event.deltaY * -0.01
      sendBack({ type: 'zoom', amount })
    } else {
      const x = event.deltaX * 0.005
      const y = event.deltaY * 0.005
      sendBack({ type: 'pan', x, y })
    }
  }
  input.addEventListener('wheel', handler)

  return () => {
    input.removeEventListener('wheel', handler)
    observer.disconnect()
  }
})

export const canvasLogic = setup({
  types: {
    context: {} as CanvasContext,
    events: {} as CanvasEvent,
  },
  actors: {
    canvasObserver: canvasObserverLogic,
  },
  actions: {
    updateViewBox: assign(({ context }) => {
      if (context.zoom === 1) {
        return {
          viewBox: `0 0 ${context.centerX * 2} ${context.centerY * 2}`,
        }
      }

      const frameCenterX = context.centerX / context.zoom
      const frameCenterY = context.centerY / context.zoom

      const rangeX = context.centerX - frameCenterX
      const rangeY = context.centerY - frameCenterY

      const viewX =
        context.centerX +
        remap(context.panX, -1, 1, -rangeX, rangeX) -
        frameCenterX
      const viewY =
        context.centerY +
        remap(context.panY, -1, 1, -rangeY, rangeY) -
        frameCenterY

      return {
        viewBox: `${viewX} ${viewY} ${frameCenterX * 2} ${frameCenterY * 2}`,
      }
    }),
    applyResize: assign(({ context, event }) => {
      assertEvent(event, 'resize')

      return {
        centerX: event.width * 0.5,
        centerY: event.height * 0.5,
      }
    }),
    applyPan: assign(({ context, event }) => {
      assertEvent(event, 'pan')

      return {
        panX: clamp(context.panX + event.x, -1, 1),
        panY: clamp(context.panY + event.y, -1, 1),
      }
    }),
    applyZoom: assign(({ context, event }) => {
      assertEvent(event, 'zoom')

      const maxZoom = 5

      const zoom = clamp(context.zoom + event.amount, 1, 5)

      return {
        zoom,
      }
    }),
  },
}).createMachine({
  id: 'canvas',
  context: {
    centerX: 0,
    centerY: 0,
    panX: 0,
    panY: 0,
    zoom: 1,
    viewBox: `0 0 0 0`,
  },
  initial: 'unmounted',
  states: {
    unmounted: { on: { mount: { target: 'mounted' } } },
    mounted: {
      invoke: {
        src: 'canvasObserver',
        input: ({ event }) => {
          assertEvent(event, 'mount')
          return event.canvas
        },
      },
      on: {
        resize: {
          actions: ['applyResize', 'updateViewBox'],
        },
        pan: {
          actions: ['applyPan', 'updateViewBox'],
        },
        zoom: {
          actions: ['applyZoom', 'updateViewBox'],
        },
      },
    },
  },
})
