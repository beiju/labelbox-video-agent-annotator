import { useEffect, useMemo, useReducer, useState } from "react"
import { Container, Row } from "react-bootstrap"
import { Sidebar } from "./Sidebar"
import { VideoLabeler } from "./VideoLabeler"
import reducer from "../reducer"
import { LabelsDispatch } from "./labels"

const defaultState = {
    loading: true,
    activeFrame: 1,
    activeAgent: null,
    agentPresent: {},
    frames: {}
}

const NO_MATCH = Symbol("NO_MATCH")

export default function Labeler() {
    const [state, dispatch] = useReducer(reducer, defaultState, i => i)

    const [sample, setSample] = useState(null)

    const experimentId = useMemo(() => {
        return new URL(window.location).searchParams.get("experiment_id")
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        const signal = controller.signal
        fetch(`//127.0.0.1:8011/api/experiment?id=${experimentId}`, { signal })
          .then(response => response.json())
          .then(sample => {
              if (signal.aborted) {
                  console.log("State restoration aborted after fetch finished")
                  return
              }
              setSample(sample)

              if (sample.label) {
                  console.log("Restoring ", sample.label)
                  dispatch({ type: 'set_state', state: sample.label })
              } else {
                  console.log("New sample")
                  dispatch({ type: 'set_state', state: defaultState })
              }
          })
          .catch(err => {
              // AbortError is for intentional aborts using AbortController, so no handling is needed
              if (err.name === 'AbortError') return

              alert(`Failed to fetch experiment: ${err}`)
          })

        return () => controller.abort()
    }, [experimentId])

    useEffect(() => {
        function listener(event) {
            const ret = (() => {
                switch (event.key) {
                    // Changing frames
                    case ' ':
                        return dispatch({ type: 'step_advance' })
                    case 'b':
                        return dispatch({ type: 'step_retreat' })

                    // Setting quality
                    case 'r':
                        return dispatch({ type: 'toggle_active_agent_is_blurred' })
                    case 'f':
                        return dispatch({ type: 'toggle_active_agent_is_obscured' })

                    // Rotating
                    case 'q':
                        return dispatch({ type: 'rotate_active_agent', by: 0.01 })
                    case 'Q':
                        return dispatch({ type: 'rotate_active_agent', by: 0.1 })
                    case 'e':
                        return dispatch({ type: 'rotate_active_agent', by: -0.01 })
                    case 'E':
                        return dispatch({ type: 'rotate_active_agent', by: -0.1 })

                    // Translating
                    case 'w':
                        return dispatch({ type: 'move_active_agent', y: -1 })
                    case 'W':
                        return dispatch({ type: 'move_active_agent', y: -10 })
                    case 'a':
                        return dispatch({ type: 'move_active_agent', x: -1 })
                    case 'A':
                        return dispatch({ type: 'move_active_agent', x: -10 })
                    case 's':
                        return dispatch({ type: 'move_active_agent', y: 1 })
                    case 'S':
                        return dispatch({ type: 'move_active_agent', y: 10 })
                    case 'd':
                        return dispatch({ type: 'move_active_agent', x: 1 })
                    case 'D':
                        return dispatch({ type: 'move_active_agent', x: 10 })

                    default:
                        break
                }
                return NO_MATCH
            })()
            if (ret !== NO_MATCH) event.preventDefault()
            return ret
        }

        document.addEventListener('keypress', listener)
        return () => document.removeEventListener('keypress', listener)
    }, [])

    // Save on every frame change
    const hasSample = !!sample
    useEffect(() => {
        if (!hasSample) return
        fetch(`//127.0.0.1:8011/api/set_label?id=${experimentId}`, {
            method: "POST",
            credentials: "include",
            headers: {
                'Content-Type': 'application/json'
                // 'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: JSON.stringify(state)
        })
          .catch(err => {
              alert(`Failed to save changes: ${err}`)
          })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasSample, state.activeFrame, experimentId])

    function returnToIndex() {
        window.location = "//127.0.0.1:8011/"
    }

    if (!sample) return (<p>Loading&hellip;</p>)

    return (<Container fluid className="h-100">
        <Row className="h-100">
            <LabelsDispatch.Provider value={dispatch}>
                <Sidebar state={state} />
                <VideoLabeler sample={sample} state={state} returnToIndex={returnToIndex} />
            </LabelsDispatch.Provider>
        </Row>
    </Container>)
}