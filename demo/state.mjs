import { FINDINGS, TEAMMATES, SAMPLE_NOW } from "./fixtures.mjs";

export const STORAGE_KEY = "mach1.preview.v2";
const statuses = new Set(["open", "in-progress", "handled", "dismissed"]);
const owners = new Set(TEAMMATES.map((person) => person.id));
const findingIds = new Set(FINDINGS.map((finding) => finding.id));
const fields = new Set([
  "ownerId",
  "status",
  "draft",
  "outcome",
  "dismissReason",
]);
const copy = (value) => JSON.parse(JSON.stringify(value));
const plain = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const safeText = (value, maximum = 20000) =>
  typeof value === "string" && value.length <= maximum;

function validPatch(patch) {
  return (
    plain(patch) &&
    Object.keys(patch).length > 0 &&
    Object.entries(patch).every(([key, value]) => {
      if (!fields.has(key)) return false;
      if (key === "status") return statuses.has(value);
      if (key === "ownerId") return value === null || owners.has(value);
      return safeText(value);
    })
  );
}

function seed() {
  return {
    version: 2,
    findings: Object.fromEntries(
      FINDINGS.map((finding) => [
        finding.id,
        {
          ownerId: finding.ownerId ?? null,
          status: finding.status,
          draft: finding.draft || "",
          activity: copy(finding.initialActivity || []),
        },
      ]),
    ),
  };
}

function decode(raw) {
  const parsed = JSON.parse(raw);
  if (!plain(parsed) || parsed.version !== 2 || !plain(parsed.findings))
    throw new Error("Invalid preview state");
  const result = seed();
  for (const [id, record] of Object.entries(parsed.findings)) {
    if (!findingIds.has(id) || !plain(record))
      throw new Error("Unknown finding");
    const { activity, ...patch } = record;
    if (
      !validPatch(patch) ||
      !Array.isArray(activity) ||
      activity.length > 10000 ||
      !activity.every(
        (event) =>
          plain(event) &&
          safeText(event.id, 200) &&
          safeText(event.at, 100) &&
          Number.isFinite(Date.parse(event.at)) &&
          safeText(event.text),
      )
    )
      throw new Error("Invalid finding state");
    result.findings[id] = {
      ...result.findings[id],
      ...patch,
      activity: activity.map(({ id, at, text }) => ({ id, at, text })),
    };
  }
  return result;
}

/** Local sample-only state. No credentials or source conversations are persisted. */
export function createStore(options = {}) {
  const now = options.now || SAMPLE_NOW;
  let storage;
  let notice = "";
  let state = seed();
  let undoRecord = null;
  let sequence = 0;
  const listeners = new Set();
  const unavailable =
    "Browser storage is unavailable. You can keep using this sample workspace, but changes may reset on reload.";
  try {
    storage = Object.hasOwn(options, "storage")
      ? options.storage
      : globalThis.localStorage;
    if (!storage) notice = unavailable;
    else {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null) {
        try {
          state = decode(raw);
        } catch {
          notice =
            "Saved sample changes could not be read. The original sample workspace has been restored.";
        }
      }
    }
  } catch {
    storage = null;
    notice = unavailable;
  }

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      storage = null;
      notice = unavailable;
    }
  }
  function emit() {
    for (const listener of listeners) listener(copy(state));
  }
  function event(text) {
    return { id: `local-${Date.now()}-${++sequence}`, at: now, text };
  }

  return {
    get notice() {
      return notice;
    },
    get canUndo() {
      return undoRecord !== null;
    },
    getState() {
      return copy(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(id, patch, activityText) {
      if (
        !findingIds.has(id) ||
        !validPatch(patch) ||
        !safeText(activityText) ||
        !activityText.trim()
      )
        return false;
      const before = copy(state.findings[id]);
      if (Object.entries(patch).every(([key, value]) => before[key] === value))
        return false;
      undoRecord = { id, before, keys: Object.keys(patch), text: activityText };
      state.findings[id] = {
        ...before,
        ...patch,
        activity: [...before.activity, event(activityText)],
      };
      persist();
      emit();
      return true;
    },
    saveDraft(id, text) {
      if (!findingIds.has(id) || !safeText(text)) return false;
      state.findings[id].draft = text;
      persist();
      return true;
    },
    undo() {
      if (!undoRecord) return false;
      const { id, before, keys, text } = undoRecord;
      const current = state.findings[id];
      for (const key of keys) {
        if (Object.hasOwn(before, key)) current[key] = before[key];
        else delete current[key];
      }
      current.activity.push(event(`Undid: ${text}`));
      undoRecord = null;
      persist();
      emit();
      return true;
    },
    reset() {
      state = seed();
      undoRecord = null;
      if (storage) {
        try {
          storage.removeItem(STORAGE_KEY);
          notice = "";
        } catch {
          storage = null;
          notice = unavailable;
        }
      }
      emit();
    },
  };
}
