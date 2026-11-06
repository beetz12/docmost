import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { buildPageUrl } from "@/features/page/page.utils";
import {
  getJournalDayActivity,
  getJournalInfo,
  getJournalMonth,
  getNotesSettings,
  listJournals,
  openJournal,
  resolveJournalConflict,
  setJournalDate,
  updateNotesSettings,
  NotesSettings,
} from "./journal-service";
import { toIsoDate } from "./journal-date-query";

export const journalKeys = {
  all: ["notes-journals"] as const,
  month: (month: string) => ["notes-journals", "month", month] as const,
  list: (includeEmpty: boolean) =>
    ["notes-journals", "list", includeEmpty] as const,
  info: (pageId: string) => ["notes-journals", "info", pageId] as const,
  activity: (date: string) => ["notes-journals", "activity", date] as const,
  settings: ["notes-settings"] as const,
};

/** Opens (creating if needed) the journal for a date and navigates to it. */
export function useOpenJournal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => openJournal(date, toIsoDate(new Date())),
    onSuccess: ({ page, created, conflict }) => {
      if (created) queryClient.invalidateQueries({ queryKey: journalKeys.all });
      if (conflict) {
        notifications.show({
          color: "yellow",
          message:
            "More than one page is the journal for this date. Open the Journal panel to keep one or merge them.",
        });
      }
      navigate(buildPageUrl(page.spaceSlug, page.slugId, page.title ?? undefined));
    },
    onError: (err: any) => {
      notifications.show({
        color: "red",
        message: err?.response?.data?.message ?? "Could not open the journal",
      });
    },
  });
}

export function useJournalMonth(month: string) {
  return useQuery({
    queryKey: journalKeys.month(month),
    queryFn: () => getJournalMonth(month),
  });
}

export function useJournalList(includeEmpty: boolean) {
  return useQuery({
    queryKey: journalKeys.list(includeEmpty),
    queryFn: () => listJournals({ includeEmpty, limit: 100 }),
  });
}

export function useJournalInfo(pageId: string | undefined) {
  return useQuery({
    queryKey: journalKeys.info(pageId ?? ""),
    queryFn: () => getJournalInfo(pageId!),
    enabled: !!pageId,
  });
}

/** Pages created or edited on a local calendar date (journals excluded). */
export function useJournalDayActivity(date: string | null) {
  return useQuery({
    queryKey: journalKeys.activity(date ?? ""),
    enabled: !!date,
    queryFn: () => {
      const [y, m, d] = date!.split("-").map(Number);
      const start = new Date(y, m - 1, d);
      const end = new Date(y, m - 1, d + 1);
      return getJournalDayActivity(start.toISOString(), end.toISOString());
    },
  });
}

export function useSetJournalDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, date }: { pageId: string; date: string | null }) =>
      setJournalDate(pageId, date),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: journalKeys.all }),
  });
}

export function useResolveJournalConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { date: string; keepPageId: string; mode: "keep" | "merge" }) =>
      resolveJournalConflict(v.date, v.keepPageId, v.mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: journalKeys.all }),
  });
}

export function useNotesSettings() {
  return useQuery({ queryKey: journalKeys.settings, queryFn: getNotesSettings });
}

export function useUpdateNotesSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: Partial<NotesSettings>) => updateNotesSettings(values),
    onSuccess: (data) => {
      queryClient.setQueryData(journalKeys.settings, data);
      notifications.show({ message: "Saved" });
    },
    onError: (err: any) =>
      notifications.show({
        color: "red",
        message: err?.response?.data?.message ?? "Could not save",
      }),
  });
}
