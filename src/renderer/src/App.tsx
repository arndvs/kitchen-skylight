import { usePushInvalidation } from './api/hooks'
import { useUi } from './stores/uiStore'
import { Header, Fab } from './features/shell/Header'
import { Toasts } from './features/shell/Toasts'
import { WeekView } from './features/calendar/WeekView'
import { DayView } from './features/calendar/DayView'
import { MonthView } from './features/calendar/MonthView'
import { AgendaView } from './features/calendar/AgendaView'
import { ChoresView } from './features/chores/ChoresView'
import { ListsView } from './features/lists/ListsView'
import { EventEditor } from './features/calendar/EventEditor'
import { SettingsSheet } from './features/settings/SettingsSheet'
import { KioskOverlays } from './features/kiosk/KioskOverlays'
import { OskTray } from './components/Osk'

export default function App() {
  usePushInvalidation()
  const view = useUi((s) => s.view)

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="min-h-0 flex-1">
        {view === 'week' && <WeekView />}
        {view === 'day' && <DayView />}
        {view === 'month' && <MonthView />}
        {view === 'agenda' && <AgendaView />}
        {view === 'chores' && <ChoresView />}
        {view === 'lists' && <ListsView />}
      </main>
      {view !== 'chores' && view !== 'lists' && <Fab />}
      <EventEditor />
      <SettingsSheet />
      <OskTray />
      <Toasts />
      <KioskOverlays />
    </div>
  )
}
