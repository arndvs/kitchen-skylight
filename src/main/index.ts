import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { openDatabase } from './db/client'
import { createSettingsService } from './services/settingsService'
import { createPeopleService } from './services/peopleService'
import { createCalendarService } from './services/calendarService'
import { createEventService } from './services/eventService'
import { registerIpcHandlers } from './ipc/router'
import { createMainWindow } from './window'

// Test harnesses point this at a temp dir so smoke runs never touch real data
if (process.env.OSL_USER_DATA) {
  app.setPath('userData', process.env.OSL_USER_DATA)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    const { db } = openDatabase(join(app.getPath('userData'), 'openskylight.db'))
    registerIpcHandlers({
      settings: createSettingsService(db),
      people: createPeopleService(db),
      calendars: createCalendarService(db),
      events: createEventService(db)
    })
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  // A wall display should restart its UI if the renderer ever crashes
  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error('[main] renderer gone:', details.reason)
    if (details.reason !== 'clean-exit') {
      for (const win of BrowserWindow.getAllWindows()) win.destroy()
      createMainWindow()
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
