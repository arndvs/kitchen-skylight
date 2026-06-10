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
    [['settings'], ['occurrences'], ['weather']]
  )
}

export function useGoogleStatus() {
  return useQuery({ queryKey: ['googleStatus'], queryFn: () => ipcInvoke('google:getStatus', undefined) })
}

export function useRemoteCalendars(accountId: string | null) {
  return useQuery({
    queryKey: ['remoteCalendars', accountId],
    queryFn: () => ipcInvoke('google:listRemoteCalendars', { accountId: accountId! }),
    enabled: accountId !== null,
    staleTime: 60_000
  })
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['syncStatus'],
    queryFn: () => ipcInvoke('sync:getStatus', undefined),
    refetchInterval: 15_000
  })
}

export function useGoogleMutations() {
  const calendarKeys = [['googleStatus'], ['remoteCalendars'], ['calendars'], ['occurrences'], ['syncStatus']]
  return {
    setCredentials: useInvalidatingMutation(
      (input: { clientId: string; clientSecret: string }) => ipcInvoke('google:setCredentials', input),
      [['googleStatus']]
    ),
    connect: useInvalidatingMutation(() => ipcInvoke('google:connect', undefined), calendarKeys),
    disconnect: useInvalidatingMutation(
      (input: { accountId: string }) => ipcInvoke('google:disconnect', input),
      calendarKeys
    ),
    setCalendarSelected: useInvalidatingMutation(
      (input: {
        accountId: string
        googleCalendarId: string
        name: string
        color: string
        readOnly: boolean
        selected: boolean
      }) => ipcInvoke('google:setCalendarSelected', input),
      calendarKeys
    )
  }
}

export function useIcsMutations() {
  return {
    add: useInvalidatingMutation(
      (input: { url: string; name: string; color: string }) => ipcInvoke('ics:add', input),
      [['calendars'], ['occurrences'], ['syncStatus']]
    )
  }
}

export function useSyncNow() {
  return useInvalidatingMutation(() => ipcInvoke('sync:now', undefined), [['syncStatus']])
}

export function useWeather() {
  return useQuery({
    queryKey: ['weather'],
    queryFn: () => ipcInvoke('weather:get', undefined),
    refetchInterval: 10 * 60_000,
    retry: 2
  })
}

export function useCitySearch() {
  return useMutation({
    mutationFn: (query: string) => ipcInvoke('weather:searchCity', { query })
  })
}

export function useAuthStatus() {
  return useQuery({ queryKey: ['authStatus'], queryFn: () => ipcInvoke('auth:getStatus', undefined) })
}

export function useAuthMutations() {
  const keys = [['authStatus']]
  return {
    verifyPin: useInvalidatingMutation((input: { pin: string }) => ipcInvoke('auth:verifyPin', input), keys),
    setPin: useInvalidatingMutation((input: { pin: string | null }) => ipcInvoke('auth:setPin', input), keys),
    lock: useInvalidatingMutation(() => ipcInvoke('auth:lock', undefined), keys)
  }
}

/** Refetch when the main process announces data changes (sync engine, other windows). */
export function usePushInvalidation(): void {
  const queryClient = useQueryClient()
  const pushToast = useToasts((s) => s.push)
  useEffect(() => {
    const offData = window.osl.on('push:dataChanged', (data) => {
      const domain = (data as { domain?: string })?.domain
      if (domain === 'events') void queryClient.invalidateQueries({ queryKey: ['occurrences'] })
      else if (domain) void queryClient.invalidateQueries({ queryKey: [domain] })
      if (domain === 'calendars') void queryClient.invalidateQueries({ queryKey: ['occurrences'] })
    })
    const offStatus = window.osl.on('push:syncStatus', () => {
      void queryClient.invalidateQueries({ queryKey: ['syncStatus'] })
    })
    const offConflict = window.osl.on('push:syncConflict', (data) => {
      const title = (data as { title?: string })?.title ?? 'An event'
      pushToast(`"${title}" was changed elsewhere — showing the latest version`)
    })
    return () => {
      offData()
      offStatus()
      offConflict()
    }
  }, [queryClient, pushToast])
}
