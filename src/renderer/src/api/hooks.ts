import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ipcInvoke } from './client'
import type {
  CalendarCreateInput,
  CalendarUpdateInput,
  EventCreateInput,
  EventDeleteInput,
  EventUpdateInput,
  PersonCreateInput,
  PersonUpdateInput,
  AppSettings
} from '@shared/types'
import type { DateRange } from '@shared/dates'
import { useToasts } from '../stores/toastStore'

export function useAppInfo() {
  return useQuery({ queryKey: ['appInfo'], queryFn: () => ipcInvoke('app:getInfo', undefined), staleTime: Infinity })
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => ipcInvoke('settings:getAll', undefined) })
}

export function usePeople() {
  return useQuery({ queryKey: ['people'], queryFn: () => ipcInvoke('people:list', undefined) })
}

export function useCalendars() {
  return useQuery({ queryKey: ['calendars'], queryFn: () => ipcInvoke('calendars:list', undefined) })
}

export function useEventDetail(id: string | null) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => ipcInvoke('events:get', { id: id! }),
    enabled: id !== null
  })
}

export function useOccurrences(range: DateRange) {
  return useQuery({
    queryKey: ['occurrences', range.start, range.end],
    queryFn: () => ipcInvoke('events:getOccurrences', { start: range.start, end: range.end }),
    placeholderData: (prev) => prev
  })
}

function useInvalidatingMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  keys: string[][]
) {
  const queryClient = useQueryClient()
  const pushToast = useToasts((s) => s.push)
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key })
    },
    onError: (err: Error) => pushToast(err.message)
  })
}

export function useEventMutations() {
  const create = useInvalidatingMutation((input: EventCreateInput) => ipcInvoke('events:create', input), [
    ['occurrences']
  ])
  const update = useInvalidatingMutation((input: EventUpdateInput) => ipcInvoke('events:update', input), [
    ['occurrences']
  ])
  const remove = useInvalidatingMutation((input: EventDeleteInput) => ipcInvoke('events:delete', input), [
    ['occurrences']
  ])
  return { create, update, remove }
}

export function usePeopleMutations() {
  const keys = [['people'], ['occurrences']]
  return {
    create: useInvalidatingMutation((input: PersonCreateInput) => ipcInvoke('people:create', input), keys),
    update: useInvalidatingMutation((input: PersonUpdateInput) => ipcInvoke('people:update', input), keys),
    remove: useInvalidatingMutation((input: { id: string }) => ipcInvoke('people:delete', input), keys)
  }
}

export function useCalendarMutations() {
  const keys = [['calendars'], ['occurrences']]
  return {
    create: useInvalidatingMutation((input: CalendarCreateInput) => ipcInvoke('calendars:create', input), keys),
    update: useInvalidatingMutation((input: CalendarUpdateInput) => ipcInvoke('calendars:update', input), keys),
    remove: useInvalidatingMutation((input: { id: string }) => ipcInvoke('calendars:delete', input), keys)
  }
}

export function useSettingsMutation() {
  return useInvalidatingMutation(
    (patch: Partial<AppSettings>) => ipcInvoke('settings:set', { patch }),
    [['settings'], ['occurrences']]
  )
}

/** Refetch when the main process announces data changes (sync engine, other windows). */
export function usePushInvalidation(): void {
  const queryClient = useQueryClient()
  useEffect(() => {
    return window.osl.on('push:dataChanged', (data) => {
      const domain = (data as { domain?: string })?.domain
      if (domain === 'events') void queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      else if (domain) void queryClient.invalidateQueries({ queryKey: [domain] })
    })
  }, [queryClient])
}
