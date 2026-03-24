import { useEffect, useRef } from 'react'
import { evaluationsApi } from '../api/evaluations'

export function useAutoSave(evalId, setEvalId, buildPayload, enabled = true) {
  const timerRef = useRef(null)
  const savingRef = useRef(false)

  const save = async () => {
    if (savingRef.current || !enabled) return
    savingRef.current = true
    try {
      const payload = buildPayload()
      if (!payload) return
      if (evalId) {
        await evaluationsApi.update(evalId, { ...payload, status: 'Draft' })
      } else {
        const res = await evaluationsApi.create({ ...payload, status: 'Draft' })
        setEvalId(res.data.evaluation.id)
      }
    } catch (err) {
      console.warn('Auto-save failed:', err.message)
    } finally {
      savingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled) return
    timerRef.current = setInterval(save, 60000)
    return () => clearInterval(timerRef.current)
  }, [evalId, enabled])

  return { triggerSave: save }
}
