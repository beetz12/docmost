import type { ColumnType, Kysely, Transaction } from 'kysely';
import type { DB } from '@docmost/db/types/db';

// Types for the notes fork's own tables. Kept out of the generated db.d.ts so
// upstream regenerations do not drop them.
type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface NotesJournals {
  id: Generated<string>;
  pageId: string;
  journalDate: ColumnType<string, string, string>;
  creatorId: string;
  spaceId: string;
  workspaceId: string;
  initialText: Generated<string>;
  createdAt: Generated<Timestamp>;
}

export interface NotesUserSettings {
  userId: string;
  workspaceId: string;
  journalSpaceId: string | null;
  journalParentPageId: string | null;
  journalTemplatePageId: string | null;
  pageTemplatePageId: string | null;
  pageTemplateEnabled: Generated<boolean>;
  updatedAt: Generated<Timestamp>;
}

export interface NotesTables {
  notesJournals: NotesJournals;
  notesUserSettings: NotesUserSettings;
}

export type NotesDB = DB & NotesTables;
export type NotesKysely = Kysely<NotesDB>;
export type NotesTrx = Transaction<NotesDB>;
