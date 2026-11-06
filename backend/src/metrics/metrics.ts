// Zentrale Stelle für alle Prometheus-Zähler.
//
// Die Zähler sind modulweite Konstanten auf der globalen prom-client-Registry,
// statt per Dependency Injection durch jeden Service gereicht zu werden: sie
// werden aus Services und Controllern gelesen, ändern nichts am Verhalten,
// und eine globale Registry ist das übliche Muster jedes Prometheus-Clients.
// Ausgeliefert werden sie nur über den separaten Metrics-Server
// (siehe metrics-server.ts), nie über den App-Port.
//
// Benennung: gifty_<nomen>_<verb>_total.
import { collectDefaultMetrics, Counter, register } from 'prom-client';

// Node-Laufzeitmetriken (Heap, GC, Event-Loop-Lag, CPU, offene Handles).
collectDefaultMetrics({ prefix: 'gifty_' });

/**
 * Registrierungsversuche. result: "success", "duplicate" (E-Mail bereits
 * vergeben), "invalid" (Pflichtfeld fehlt) oder "error".
 */
export const signupsTotal = new Counter({
  name: 'gifty_signups_total',
  help: 'Total number of account registration attempts, by result.',
  labelNames: ['result'] as const,
});

/**
 * Login-Versuche. result: "success", "invalid" (unbekannte E-Mail oder
 * falsches Passwort – bewusst nicht unterschieden) oder "error". Anfragen,
 * die schon an der DTO-Validierung scheitern (400), erreichen den Service
 * nicht und tauchen nur in gifty_http_requests_total auf.
 */
export const loginAttemptsTotal = new Counter({
  name: 'gifty_login_attempts_total',
  help: 'Total number of login attempts, by result.',
  labelNames: ['result'] as const,
});

/**
 * Token-Erneuerungen über /auth/refresh. result: "success", "invalid"
 * (abgelaufen, gefälscht oder bereits rotiert) oder "error".
 */
export const tokenRefreshesTotal = new Counter({
  name: 'gifty_token_refreshes_total',
  help: 'Total number of access token refreshes, by result.',
  labelNames: ['result'] as const,
});

/** Erfolgreiche Logouts. */
export const logoutsTotal = new Counter({
  name: 'gifty_logouts_total',
  help: 'Total number of logouts.',
});

/** Angelegte Geburtstage (Validierungsfehler zählen nicht mit). */
export const birthdaysCreatedTotal = new Counter({
  name: 'gifty_birthdays_created_total',
  help: 'Total number of birthdays created.',
});

/** Geänderte Geburtstage – nur wenn der Eintrag gefunden wurde. */
export const birthdaysUpdatedTotal = new Counter({
  name: 'gifty_birthdays_updated_total',
  help: 'Total number of birthdays updated.',
});

/** Gelöschte Geburtstage – nur wenn tatsächlich eine Zeile gelöscht wurde. */
export const birthdaysDeletedTotal = new Counter({
  name: 'gifty_birthdays_deleted_total',
  help: 'Total number of birthdays deleted.',
});

/**
 * Freigaben der eigenen Geburtstage an andere User. action: "requested"
 * (Anfrage gestellt), "accepted" (Empfänger hat bestätigt), "declined"
 * (Empfänger lehnt offene Anfrage ab), "revoked" (Besitzer zieht Anfrage
 * zurück oder beendet die Freigabe) oder "left" (Empfänger beendet eine
 * bestätigte Freigabe).
 */
export const birthdaySharesTotal = new Counter({
  name: 'gifty_birthday_shares_total',
  help: 'Total number of birthday sharing events, by action.',
  labelNames: ['action'] as const,
});

/**
 * Abrufe des öffentlichen Kalender-Feeds (Abo-URL mit Token), die Google,
 * Apple, Proton & Co. regelmäßig pollen. result: "served" oder "not_found"
 * (unbekannter oder ungültiger Token – ein Anstieg deutet auf Raten hin).
 */
export const calendarFeedRequestsTotal = new Counter({
  name: 'gifty_calendar_feed_requests_total',
  help: 'Total number of public calendar feed requests, by result.',
  labelNames: ['result'] as const,
});

/** Downloads der .ics-Datei durch eingeloggte User (nicht der Abo-Feed). */
export const calendarDownloadsTotal = new Counter({
  name: 'gifty_calendar_downloads_total',
  help: 'Total number of authenticated .ics calendar downloads.',
});

/** Neu erzeugte Kalender-Abo-URLs (alter Token wird damit ungültig). */
export const calendarUrlRegenerationsTotal = new Counter({
  name: 'gifty_calendar_url_regenerations_total',
  help: 'Total number of calendar feed URL regenerations.',
});

/**
 * Rückkehr vom Todoist-OAuth-Flow. result: "connected", "denied" (User hat
 * bei Todoist abgelehnt) oder "error".
 */
export const todoistConnectionsTotal = new Counter({
  name: 'gifty_todoist_connections_total',
  help: 'Total number of Todoist OAuth callbacks, by result.',
  labelNames: ['result'] as const,
});

/** Getrennte Todoist-Verbindungen (nur wenn eine bestand). */
export const todoistDisconnectionsTotal = new Counter({
  name: 'gifty_todoist_disconnections_total',
  help: 'Total number of Todoist disconnections.',
});

/**
 * Todoist-Synchronisationen pro User. trigger: "cron" (täglicher Lauf),
 * "manual" (Button im Dashboard) oder "connect" (direkt nach dem Verbinden);
 * result: "success" oder "error". Ein Sync, bei dem nur einzelne Aufgaben
 * scheitern, zählt als "success" – die landen in todoistTasksCreatedTotal.
 */
export const todoistSyncsTotal = new Counter({
  name: 'gifty_todoist_syncs_total',
  help: 'Total number of per-user Todoist syncs, by trigger and result.',
  labelNames: ['trigger', 'result'] as const,
});

/**
 * In Todoist angelegte Aufgaben. result: "created" oder "failed". Bereits
 * angelegte (übersprungene) Aufgaben zählen nicht.
 */
export const todoistTasksCreatedTotal = new Counter({
  name: 'gifty_todoist_tasks_created_total',
  help: 'Total number of Todoist tasks created during syncs, by result.',
  labelNames: ['result'] as const,
});

export { register };
