import { type Kysely, sql } from 'kysely';

// Notes fork (beetz12/docmost): daily journals and per-user notes settings.
// Kept in our own tables so upstream Docmost migrations stay untouched.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('notes_journals')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_uuid_v7()`),
    )
    .addColumn('page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('cascade').notNull().unique(),
    )
    .addColumn('journal_date', 'date', (col) => col.notNull())
    .addColumn('creator_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade').notNull(),
    )
    .addColumn('space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    // text content right after creation (template applied); used to detect empty journals
    .addColumn('initial_text', 'text', (col) => col.notNull().defaultTo(''))
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // not unique: two pages may share a date (import/sync conflict); the UI resolves it
  await db.schema
    .createIndex('notes_journals_owner_date_idx')
    .on('notes_journals')
    .columns(['workspace_id', 'creator_id', 'journal_date'])
    .execute();

  await db.schema
    .createTable('notes_user_settings')
    .addColumn('user_id', 'uuid', (col) =>
      col.primaryKey().references('users.id').onDelete('cascade'),
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade').notNull(),
    )
    .addColumn('journal_space_id', 'uuid', (col) =>
      col.references('spaces.id').onDelete('set null'),
    )
    .addColumn('journal_parent_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .addColumn('journal_template_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .addColumn('page_template_page_id', 'uuid', (col) =>
      col.references('pages.id').onDelete('set null'),
    )
    .addColumn('page_template_enabled', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('updated_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('notes_user_settings').ifExists().execute();
  await db.schema.dropTable('notes_journals').ifExists().execute();
}
