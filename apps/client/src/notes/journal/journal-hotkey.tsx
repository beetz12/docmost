import { useEffect } from "react";
import { useHotkeys } from "@mantine/hooks";
import { useNavigate } from "react-router-dom";
import { useOpenJournal } from "./journal-queries";
import { toIsoDate } from "./journal-date-query";

// Alt+Shift+J: not used by Chrome, Safari or Firefox, and does not type a character in the editor.
export const JOURNAL_HOTKEY = "alt+shift+J";
export const JOURNAL_HOTKEY_LABEL =
  typeof navigator !== "undefined" && /Mac/.test(navigator.platform)
    ? "⌥⇧J"
    : "Alt+Shift+J";

/** Global shortcut that opens today's journal from anywhere in the app. Renders nothing. */
export function JournalHotkey() {
  const openJournal = useOpenJournal();
  useHotkeys(
    [[JOURNAL_HOTKEY, () => openJournal.mutate(toIsoDate(new Date()))]],
    [], // also fire inside inputs
    true, // and inside the editor (contenteditable)
  );
  return null;
}

/** Route element for /journal: opens today's journal (creating it) and redirects to it. */
export function JournalTodayRedirect() {
  const openJournal = useOpenJournal();
  const navigate = useNavigate();
  useEffect(() => {
    openJournal.mutate(toIsoDate(new Date()), {
      onError: () => navigate("/journals", { replace: true }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
