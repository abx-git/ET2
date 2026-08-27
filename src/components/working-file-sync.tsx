"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  FileConflictDialog,
  type FileConflictChoice,
} from "@/components/file-conflict-dialog";
import {
  applyBoardJsonToStore,
  applyBoardJsonToStoreInPlace,
  boardJsonFromStoreState,
  boardPersistKeyFromStoreState,
} from "@/lib/file-board-reconcile";
import { classifyExternalWorkingFile } from "@/lib/working-file-external-sync";
import { boardJsonHasContent } from "@/lib/working-file-write-fence";
import {
  downloadWorkingFileSafetyCopy,
  EXTERNAL_WORKING_FILE_POLL_MS,
  getWorkingFileHandle,
  getWorkingFileLabel,
  getActiveWorkingFileId,
  getLastSyncedBoardJson,
  isKnownFileRevision,
  isMobileWorkingFileMode,
  isWorkingFileAttached,
  isWorkingFileDirty,
  isWorkingFileMultiTabUnsafe,
  isWorkingFilePersistPaused,
  isWorkingFileSwitchInProgress,
  markWorkingFileSessionHydrated,
  markWorkingFileSynced,
  peekWorkingFileLastModified,
  persistWorkingFileJson,
  readWorkingFileSnapshot,
  restoreWorkingFileFromDisk,
  shouldSuppressExternalFilePoll,
  wasWorkingFileSessionHydrated,
  WORKING_FILE_ATTACHED_EVENT,
  WORKING_FILE_DETACHED_EVENT,
  WORKING_FILE_PERSIST_PAUSED_EVENT,
  setWorkingFilePersistPaused,
} from "@/lib/working-file";
import { mayAutoRestoreWorkingFileFromStorage } from "@/lib/working-file-safety";
import {
  bindTabWorkingFile,
  getOrCreateTabSessionId,
  resolvePreferredWorkingFileId,
  resolvePreferredWorkingFileName,
} from "@/lib/working-file-tab-context";
import {
  ensureWorkingFileWriter,
  isWorkingFileWriterLeader,
  onWorkingFileWriterRoleChange,
  stopWorkingFileWriter,
} from "@/lib/working-file-writer";
import { useTaskTreeStore } from "@/store/task-tree-store";

function ensureWriterForAttachedFile(): void {
  const wf = getActiveWorkingFileId();
  const label = getWorkingFileLabel();
  if (wf && isWorkingFileAttached()) {
    ensureWorkingFileWriter(wf);
  } else if (label && isWorkingFileAttached()) {
    ensureWorkingFileWriter(label);
  } else {
    stopWorkingFileWriter();
  }
}

export interface WorkingFileSyncProps {
  onWorkingFileNameChange: (fileName: string | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSavingChange?: (saving: boolean) => void;
  onNeedsFileSetup?: () => void;
  onPersistPausedChange?: (paused: boolean) => void;
  onMultiTabUnsafeChange?: (unsafe: boolean) => void;
}

/**
 * Autosave with content+mtime CAS.
 * External file edits: poll while visible, adopt disk in place when the editor is clean,
 * and open a conflict dialog when both sides changed.
 */
export function WorkingFileSync({
  onWorkingFileNameChange,
  onDirtyChange,
  onSavingChange,
  onNeedsFileSetup,
  onPersistPausedChange,
  onMultiTabUnsafeChange,
}: WorkingFileSyncProps) {
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  const callbacksRef = useRef({
    onWorkingFileNameChange,
    onDirtyChange,
    onSavingChange,
    onNeedsFileSetup,
    onPersistPausedChange,
    onMultiTabUnsafeChange,
  });
  callbacksRef.current = {
    onWorkingFileNameChange,
    onDirtyChange,
    onSavingChange,
    onNeedsFileSetup,
    onPersistPausedChange,
    onMultiTabUnsafeChange,
  };

  const mountedRef = useRef(true);
  const saveQueuedRef = useRef(false);
  const saveInFlightRef = useRef(false);
  /** True when board changed while a write was in flight — flush again after. */
  const persistAgainRef = useRef(false);
  const suspendAutoPersistRef = useRef(false);
  const conflictActiveRef = useRef(false);
  const lastPersistKeyRef = useRef<string | null>(null);
  const persistDebounceTimerRef = useRef<number | null>(null);

  const AUTOSAVE_DEBOUNCE_MS = 250;

  const syncFileLabel = () => {
    callbacksRef.current.onWorkingFileNameChange(getWorkingFileLabel());
  };

  const syncDirty = () => {
    callbacksRef.current.onDirtyChange?.(isWorkingFileDirty());
  };

  const syncPaused = () => {
    callbacksRef.current.onPersistPausedChange?.(isWorkingFilePersistPaused());
  };

  const handleConflictChoice = useCallback(
    async (choice: FileConflictChoice) => {
      if (conflictBusy) return;
      const handle = getWorkingFileHandle();
      if (!handle && !isMobileWorkingFileMode()) return;

      setConflictBusy(true);
      suspendAutoPersistRef.current = true;
      let resolved = false;

      try {
        if (choice === "load_file" && handle) {
          const snap = await readWorkingFileSnapshot(handle);
          if (!snap) return;
          if (!snap.text.trim()) {
            window.alert(
              "Die Arbeitsdatei ist leer (möglicherweise Sync). Lokaler Stand bleibt erhalten.",
            );
            return;
          }
          const loaded = applyBoardJsonToStoreInPlace(snap.text);
          if (!loaded) {
            window.alert(
              "Die Arbeitsdatei konnte nicht gelesen werden (ungültiges JSON). Lokaler Stand bleibt erhalten.",
            );
            return;
          }
          setWorkingFilePersistPaused(false);
          markWorkingFileSynced(snap.text, snap.lastModified);
          lastPersistKeyRef.current = boardPersistKeyFromStoreState();
          syncDirty();
          syncPaused();
          resolved = true;
          return;
        }

        // Keep editor → Speichern unter path: pause + safety download of disk
        if (handle) {
          const snap = await readWorkingFileSnapshot(handle);
          if (snap?.text) downloadWorkingFileSafetyCopy(snap.text, "disk");
        }
        setWorkingFilePersistPaused(true, "external_conflict");
        syncPaused();
        syncDirty();
        resolved = true;
      } finally {
        if (resolved) {
          conflictActiveRef.current = false;
          setConflictOpen(false);
        }
        suspendAutoPersistRef.current = false;
        setConflictBusy(false);
      }
    },
    [conflictBusy],
  );

  useEffect(() => {
    mountedRef.current = true;
    let storeUnsub: (() => void) | undefined;
    let roleUnsub: (() => void) | undefined;
    let pollId: number | null = null;
    const externalListeners: Array<{ target: EventTarget; type: string; listener: () => void }> =
      [];

    const flushPersist = async (): Promise<boolean> => {
      if (
        !isWorkingFileAttached() ||
        isWorkingFilePersistPaused() ||
        isWorkingFileSwitchInProgress() ||
        !isWorkingFileWriterLeader() ||
        conflictActiveRef.current ||
        suspendAutoPersistRef.current
      ) {
        return false;
      }
      if (saveInFlightRef.current) {
        persistAgainRef.current = true;
        return false;
      }
      if (!isWorkingFileDirty()) {
        persistAgainRef.current = false;
        syncDirty();
        return true;
      }

      saveInFlightRef.current = true;
      callbacksRef.current.onSavingChange?.(true);
      let wroteOk = false;
      try {
        const result = await persistWorkingFileJson(boardJsonFromStoreState());
        if (!mountedRef.current) return false;
        if (result.ok) {
          lastPersistKeyRef.current = boardPersistKeyFromStoreState();
          syncDirty();
          wroteOk = true;
          return true;
        }
        if (result.reason === "disk_unstable") {
          syncDirty();
          return false;
        }
        if (result.reason === "conflict" || result.reason === "content_cas_mismatch") {
          conflictActiveRef.current = true;
          suspendAutoPersistRef.current = true;
          setWorkingFilePersistPaused(true, "external_conflict");
          if (mountedRef.current) setConflictOpen(true);
          syncDirty();
          syncPaused();
          return false;
        }
        // Never skipCas-retry: that can overwrite a remote shared-folder revision.
        syncDirty();
        return false;
      } finally {
        saveInFlightRef.current = false;
        if (mountedRef.current) callbacksRef.current.onSavingChange?.(false);
        // Edits during the write (or a queued "again") must not stay unsaved.
        if (
          mountedRef.current &&
          (persistAgainRef.current || (wroteOk && isWorkingFileDirty()))
        ) {
          persistAgainRef.current = false;
          schedulePersistOnChange();
        }
      }
    };

    const schedulePersistOnChange = () => {
      if (
        !isWorkingFileAttached() ||
        isWorkingFilePersistPaused() ||
        isWorkingFileSwitchInProgress() ||
        !isWorkingFileWriterLeader() ||
        conflictActiveRef.current ||
        suspendAutoPersistRef.current
      ) {
        return;
      }
      if (saveInFlightRef.current) {
        persistAgainRef.current = true;
        return;
      }
      if (persistDebounceTimerRef.current != null) {
        window.clearTimeout(persistDebounceTimerRef.current);
        persistDebounceTimerRef.current = null;
      }
      saveQueuedRef.current = true;
      persistDebounceTimerRef.current = window.setTimeout(() => {
        persistDebounceTimerRef.current = null;
        saveQueuedRef.current = false;
        void flushPersist();
      }, AUTOSAVE_DEBOUNCE_MS);
    };

    const onPersistedBoardChanged = () => {
      if (suspendAutoPersistRef.current) return;
      if (useTaskTreeStore.getState().canvasGeometryGesture) return;
      if (isWorkingFilePersistPaused()) {
        syncDirty();
        return;
      }
      const key = boardPersistKeyFromStoreState();
      if (key === lastPersistKeyRef.current) return;
      // Do not mark the key as "handled" until a successful write — otherwise a
      // skipped/failed flush leaves the board permanently "ungespeichert".
      syncDirty();
      schedulePersistOnChange();
    };

    const applyExternalFileIfNeeded = async () => {
      if (isMobileWorkingFileMode()) return;
      if (
        isWorkingFilePersistPaused() ||
        isWorkingFileSwitchInProgress() ||
        conflictActiveRef.current ||
        suspendAutoPersistRef.current ||
        saveInFlightRef.current ||
        shouldSuppressExternalFilePoll()
      ) {
        return;
      }

      const handle = getWorkingFileHandle();
      if (!handle) return;

      const mtime = await peekWorkingFileLastModified(handle);
      if (mtime == null || !mountedRef.current) return;
      if (isKnownFileRevision(mtime)) return;

      const snap = await readWorkingFileSnapshot(handle);
      if (!snap || !mountedRef.current) return;

      const localJson = boardJsonFromStoreState();
      const decision = classifyExternalWorkingFile({
        diskJson: snap.text,
        localJson,
        editorDirty: isWorkingFileDirty(localJson),
        lastSyncedHadContent: boardJsonHasContent(getLastSyncedBoardJson() ?? ""),
      });

      if (decision.action === "ignore") {
        return;
      }

      if (decision.action === "mark_equivalent") {
        markWorkingFileSynced(snap.text, snap.lastModified);
        syncDirty();
        return;
      }

      if (decision.action === "conflict") {
        conflictActiveRef.current = true;
        suspendAutoPersistRef.current = true;
        setWorkingFilePersistPaused(true, "external_conflict");
        setConflictOpen(true);
        syncPaused();
        syncDirty();
        return;
      }

      suspendAutoPersistRef.current = true;
      try {
        const loaded = applyBoardJsonToStoreInPlace(snap.text);
        if (!loaded) return;
        markWorkingFileSynced(snap.text, snap.lastModified);
        lastPersistKeyRef.current = boardPersistKeyFromStoreState();
      } finally {
        suspendAutoPersistRef.current = false;
      }
      syncDirty();
    };

    const hydrateFromWorkingFileOnce = async (): Promise<void> => {
      if (wasWorkingFileSessionHydrated()) return;

      const handle = getWorkingFileHandle();
      if (handle) {
        const snap = await readWorkingFileSnapshot(handle);
        if (!snap || !mountedRef.current) return;
        markWorkingFileSessionHydrated();

        suspendAutoPersistRef.current = true;
        try {
          if (snap.text.trim()) {
            const loaded = applyBoardJsonToStore(snap.text);
            if (!loaded) {
              console.error("Arbeitsdatei konnte nicht geladen werden — Board-JSON ungültig.");
              window.alert(
                "Die Arbeitsdatei konnte nicht geladen werden. Bitte Backup einspielen oder die Datei prüfen.",
              );
              return;
            }
            markWorkingFileSynced(snap.text, snap.lastModified);
          } else {
            markWorkingFileSynced(boardJsonFromStoreState(), snap.lastModified);
          }
        } finally {
          suspendAutoPersistRef.current = false;
        }
        return;
      }

      if (isMobileWorkingFileMode()) {
        const synced = getLastSyncedBoardJson();
        if (!synced?.trim()) {
          callbacksRef.current.onNeedsFileSetup?.();
          return;
        }
        markWorkingFileSessionHydrated();
        suspendAutoPersistRef.current = true;
        try {
          const loaded = applyBoardJsonToStore(synced);
          if (!loaded) {
            console.error("Gespeichertes Board konnte nicht geladen werden.");
            callbacksRef.current.onNeedsFileSetup?.();
            return;
          }
        } finally {
          suspendAutoPersistRef.current = false;
        }
        return;
      }

      callbacksRef.current.onNeedsFileSetup?.();
    };

    const addExternalListener = (target: EventTarget, type: string, listener: () => void) => {
      target.addEventListener(type, listener);
      externalListeners.push({ target, type, listener });
    };

    void (async () => {
      getOrCreateTabSessionId();
      callbacksRef.current.onMultiTabUnsafeChange?.(isWorkingFileMultiTabUnsafe());
      const preferred = resolvePreferredWorkingFileName();
      const preferredWf = resolvePreferredWorkingFileId();
      if (mayAutoRestoreWorkingFileFromStorage() || preferred || preferredWf) {
        await restoreWorkingFileFromDisk(preferred, preferredWf);
      }
      if (!mountedRef.current) return;
      ensureWriterForAttachedFile();
      await hydrateFromWorkingFileOnce();
      if (!mountedRef.current) return;

      lastPersistKeyRef.current = boardPersistKeyFromStoreState();
      syncFileLabel();
      syncDirty();
      syncPaused();

      storeUnsub = useTaskTreeStore.subscribe(onPersistedBoardChanged);
      roleUnsub = onWorkingFileWriterRoleChange((role) => {
        if (role !== "leader") return;
        void (async () => {
          await applyExternalFileIfNeeded();
          if (conflictActiveRef.current || isWorkingFilePersistPaused()) return;
          void flushPersist();
        })();
      });

      const reflectSlotInUrl = () => {
        const wf = getActiveWorkingFileId();
        if (!wf || !isWorkingFileAttached()) return;
        bindTabWorkingFile(wf, getWorkingFileLabel());
      };
      const runExternalCheck = () => {
        reflectSlotInUrl();
        void applyExternalFileIfNeeded();
      };
      addExternalListener(window, "focus", runExternalCheck);
      addExternalListener(window, "pageshow", runExternalCheck);
      addExternalListener(document, "visibilitychange", () => {
        if (document.visibilityState === "visible") runExternalCheck();
      });

      pollId = window.setInterval(() => {
        if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
        void applyExternalFileIfNeeded();
      }, EXTERNAL_WORKING_FILE_POLL_MS);

      const onPageHide = () => {
        if (conflictActiveRef.current || isWorkingFilePersistPaused()) return;
        void flushPersist();
      };
      window.addEventListener("pagehide", onPageHide);
      externalListeners.push({ target: window, type: "pagehide", listener: onPageHide });

      const onWorkingFileAttached = () => {
        ensureWriterForAttachedFile();
        lastPersistKeyRef.current = boardPersistKeyFromStoreState();
        syncFileLabel();
        syncDirty();
        syncPaused();
        void applyExternalFileIfNeeded();
      };
      addExternalListener(window, WORKING_FILE_ATTACHED_EVENT, onWorkingFileAttached);
      addExternalListener(window, WORKING_FILE_DETACHED_EVENT, onWorkingFileAttached);
      addExternalListener(window, WORKING_FILE_PERSIST_PAUSED_EVENT, () => {
        syncPaused();
        syncDirty();
        syncFileLabel();
      });
    })();

    return () => {
      mountedRef.current = false;
      if (pollId != null) window.clearInterval(pollId);
      if (persistDebounceTimerRef.current != null) {
        window.clearTimeout(persistDebounceTimerRef.current);
        persistDebounceTimerRef.current = null;
      }
      storeUnsub?.();
      roleUnsub?.();
      stopWorkingFileWriter();
      for (const { target, type, listener } of externalListeners) {
        target.removeEventListener(type, listener);
      }
    };
  }, []);

  return (
    <FileConflictDialog
      open={conflictOpen}
      fileName={getWorkingFileLabel()}
      busy={conflictBusy}
      title="Datei wurde extern geändert"
      description="Dein Editor-Stand bleibt erhalten. Du kannst die Datei laden oder den Editor behalten und später unter neuem Namen speichern."
      keepLocalLabel="Editor behalten (Datei-Kopie laden)"
      loadFileLabel="Datei in ET2 laden"
      onChoose={(choice) => void handleConflictChoice(choice)}
    />
  );
}
