import api from "@/lib/api-client";

export interface JournalPageRef {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  spaceSlug: string;
  journalDate: string;
  isEmpty: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDay {
  date: string;
  count: number;
  conflict: boolean;
  empty: boolean;
}

export interface ActivityPage {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesSettings {
  journalSpaceId: string | null;
  journalParentPageId: string | null;
  journalTemplatePageId: string | null;
  pageTemplatePageId: string | null;
  pageTemplateEnabled: boolean;
}

const post = async <T>(path: string, body: object = {}): Promise<T> => {
  const res = await api.post<T>(path, body);
  return res.data;
};

export const openJournal = (date: string, today: string) =>
  post<{ page: JournalPageRef; created: boolean; conflict: boolean }>(
    "/notes/journals/open",
    { date, today },
  );

export const getJournalsByDate = (date: string) =>
  post<{ items: JournalPageRef[]; conflict: boolean }>(
    "/notes/journals/by-date",
    { date },
  );

export const getJournalMonth = (month: string) =>
  post<{ month: string; days: JournalDay[] }>("/notes/journals/month", {
    month,
  });

export const listJournals = (opts: {
  includeEmpty?: boolean;
  limit?: number;
  before?: string;
}) => post<{ items: JournalPageRef[] }>("/notes/journals/list", opts);

export const getJournalInfo = (pageId: string) =>
  post<{ journalDate: string | null; conflict?: boolean; pages: JournalPageRef[] }>(
    "/notes/journals/info",
    { pageId },
  );

export const setJournalDate = (pageId: string, date: string | null) =>
  post<{ journalDate: string | null }>("/notes/journals/set-date", {
    pageId,
    date,
  });

export const resolveJournalConflict = (
  date: string,
  keepPageId: string,
  mode: "keep" | "merge",
) => post("/notes/journals/resolve", { date, keepPageId, mode });

export const getJournalDayActivity = (start: string, end: string) =>
  post<{ created: ActivityPage[]; edited: ActivityPage[] }>(
    "/notes/journals/day-activity",
    { start, end },
  );

export const getNotesSettings = () => post<NotesSettings>("/notes/settings/get");

export const updateNotesSettings = (values: Partial<NotesSettings>) =>
  post<NotesSettings>("/notes/settings/update", values);
