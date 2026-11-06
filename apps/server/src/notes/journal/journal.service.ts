import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { executeTx } from '@docmost/db/utils';
import { User } from '@docmost/db/types/entity.types';
import { PageService } from '../../core/page/services/page.service';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { jsonToText } from '../../collaboration/collaboration.util';
import { NotesKysely, NotesTrx } from '../notes-db.types';
import { NotesSettingsService } from '../settings/notes-settings.service';
import {
  fillTemplateDoc,
  isJournalEmpty,
  isValidJournalDate,
  journalCreatedAt,
  monthRange,
} from './journal-date.util';

export interface JournalPageRef {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  spaceSlug: string;
  journalDate: string;
  isEmpty: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const JOURNAL_PARENT_TITLE = 'Journal';

@Injectable()
export class JournalService {
  private readonly db: NotesKysely;

  constructor(
    @InjectKysely() db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pageService: PageService,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly settingsService: NotesSettingsService,
  ) {
    this.db = db as unknown as NotesKysely;
  }

  private assertDate(date: string) {
    if (!isValidJournalDate(date)) {
      throw new BadRequestException('date must be a valid YYYY-MM-DD date');
    }
  }

  /** Base query: the user's journals on pages that are not deleted, in spaces the user belongs to. */
  private journalsQuery(user: User, workspaceId: string) {
    return this.db
      .selectFrom('notesJournals as j')
      .innerJoin('pages as p', 'p.id', 'j.pageId')
      .innerJoin('spaces as s', 's.id', 'p.spaceId')
      .where('j.workspaceId', '=', workspaceId)
      .where('j.creatorId', '=', user.id)
      .where('p.deletedAt', 'is', null)
      .where(
        'p.spaceId',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(user.id) as any,
      )
      .select([
        'p.id',
        'p.slugId',
        'p.title',
        'p.icon',
        'p.spaceId',
        's.slug as spaceSlug',
        'p.createdAt',
        'p.updatedAt',
        'p.textContent',
        'j.initialText',
        sql<string>`to_char(j.journal_date, 'YYYY-MM-DD')`.as('journalDate'),
      ]);
  }

  private toRef(row: any): JournalPageRef {
    return {
      id: row.id,
      slugId: row.slugId,
      title: row.title,
      icon: row.icon,
      spaceId: row.spaceId,
      spaceSlug: row.spaceSlug,
      journalDate: row.journalDate,
      isEmpty: isJournalEmpty(row.textContent, row.initialText),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /** All of the user's journal pages for one date (more than one means a conflict). */
  async getByDate(
    user: User,
    workspaceId: string,
    date: string,
  ): Promise<JournalPageRef[]> {
    this.assertDate(date);
    const rows = await this.journalsQuery(user, workspaceId)
      .where('j.journalDate', '=', date as any)
      .orderBy('p.createdAt', 'asc')
      .execute();
    return rows.map((r) => this.toRef(r));
  }

  /**
   * Returns the journal for a date, creating it if missing.
   * `today` is the client's local date; it decides whether created_at is back/forward-dated.
   */
  async open(
    user: User,
    workspaceId: string,
    date: string,
    today: string,
  ): Promise<{ page: JournalPageRef; created: boolean; conflict: boolean }> {
    this.assertDate(date);
    if (today !== undefined && !isValidJournalDate(today)) {
      throw new BadRequestException('today must be a valid YYYY-MM-DD date');
    }

    const existing = await this.getByDate(user, workspaceId, date);
    if (existing.length > 0) {
      return { page: existing[0], created: false, conflict: existing.length > 1 };
    }

    const spaceId = await this.resolveJournalSpace(user, workspaceId);
    const template = await this.resolveTemplate(user, workspaceId);
    // committed before the journal transaction: PageService.create looks the parent up outside our transaction
    const parentPageId = await this.resolveJournalParent(
      user,
      workspaceId,
      spaceId,
    );

    await executeTx(this.db as unknown as KyselyDB, async (trx) => {
      const ntrx = trx as unknown as NotesTrx;
      // serialize concurrent opens of the same date by the same user
      await sql`select pg_advisory_xact_lock(hashtext(${`notes-journal:${user.id}:${date}`}))`.execute(
        trx,
      );
      const again = await ntrx
        .selectFrom('notesJournals as j')
        .innerJoin('pages as p', 'p.id', 'j.pageId')
        .select('j.id')
        .where('j.creatorId', '=', user.id)
        .where('j.workspaceId', '=', workspaceId)
        .where('j.journalDate', '=', date as any)
        .where('p.deletedAt', 'is', null)
        .executeTakeFirst();
      if (again) return;

      const content = template ? fillTemplateDoc(template, date) : undefined;
      const page = await this.pageService.create(
        user.id,
        workspaceId,
        {
          title: date,
          spaceId,
          parentPageId,
          ...(content ? { content, format: 'json' as const } : {}),
        },
        trx,
      );

      const createdAt = journalCreatedAt(date, today ?? date);
      if (createdAt) {
        await trx
          .updateTable('pages')
          .set({ createdAt, updatedAt: createdAt })
          .where('id', '=', page.id)
          .execute();
      }

      await ntrx
        .insertInto('notesJournals')
        .values({
          pageId: page.id,
          journalDate: date,
          creatorId: user.id,
          spaceId,
          workspaceId,
          initialText: content ? jsonToText(content as any) : '',
        })
        .execute();
    });

    const created = await this.getByDate(user, workspaceId, date);
    if (created.length === 0) {
      throw new NotFoundException('Journal could not be created');
    }
    return {
      page: created[0],
      created: true,
      conflict: created.length > 1,
    };
  }

  /** Days in a month that have journals, with conflict and empty flags. */
  async month(user: User, workspaceId: string, month: string) {
    const range = monthRange(month);
    if (!range) throw new BadRequestException('month must be YYYY-MM');
    const rows = await this.journalsQuery(user, workspaceId)
      .where('j.journalDate', '>=', range.start as any)
      .where('j.journalDate', '<=', range.end as any)
      .execute();

    const byDate = new Map<string, JournalPageRef[]>();
    for (const r of rows) {
      const ref = this.toRef(r);
      byDate.set(ref.journalDate, [...(byDate.get(ref.journalDate) ?? []), ref]);
    }
    const days = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pages]) => ({
        date,
        count: pages.length,
        conflict: pages.length > 1,
        empty: pages.every((p) => p.isEmpty),
      }));
    return { month, days };
  }

  /** Journals newest first; empty journals are left out unless includeEmpty is true. */
  async list(
    user: User,
    workspaceId: string,
    opts: { includeEmpty?: boolean; limit?: number; before?: string },
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    if (opts.before) this.assertDate(opts.before);
    const rows = await this.journalsQuery(user, workspaceId)
      .$if(Boolean(opts.before), (qb) =>
        qb.where('j.journalDate', '<', opts.before as any),
      )
      .orderBy('j.journalDate', 'desc')
      .orderBy('p.createdAt', 'asc')
      // over-fetch so filtering empty journals still fills the page
      .limit(opts.includeEmpty ? limit : limit * 3)
      .execute();
    let items = rows.map((r) => this.toRef(r));
    if (!opts.includeEmpty) items = items.filter((i) => !i.isEmpty);
    return { items: items.slice(0, limit) };
  }

  /** Journal info for a page: its date (or null) and any other pages with the same date. */
  async info(user: User, workspaceId: string, pageId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }
    await this.pageAccessService.validateCanView(page, user);

    const row = await this.db
      .selectFrom('notesJournals')
      .select(sql<string>`to_char(journal_date, 'YYYY-MM-DD')`.as('journalDate'))
      .select('creatorId')
      .where('pageId', '=', pageId)
      .executeTakeFirst();
    if (!row) return { journalDate: null, pages: [] as JournalPageRef[] };

    const pages =
      row.creatorId === user.id
        ? await this.getByDate(user, workspaceId, row.journalDate)
        : [];
    return {
      journalDate: row.journalDate,
      conflict: pages.length > 1,
      pages,
    };
  }

  /** Marks a page as the journal for a date, or turns a journal back into a normal page (date null). */
  async setDate(
    user: User,
    workspaceId: string,
    pageId: string,
    date: string | null,
  ) {
    const page = await this.pageRepo.findById(pageId, {
      includeTextContent: true,
    });
    if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
      throw new NotFoundException('Page not found');
    }
    await this.pageAccessService.validateCanEdit(page, user);

    if (date === null) {
      await this.db
        .deleteFrom('notesJournals')
        .where('pageId', '=', pageId)
        .execute();
      return { journalDate: null };
    }

    this.assertDate(date);
    await this.db
      .insertInto('notesJournals')
      .values({
        pageId,
        journalDate: date,
        creatorId: user.id,
        spaceId: page.spaceId,
        workspaceId,
        // an existing page already has content of its own; it is never "empty"
        initialText: '',
      })
      .onConflict((oc) =>
        oc.column('pageId').doUpdateSet({ journalDate: date, creatorId: user.id }),
      )
      .execute();
    return { journalDate: date };
  }

  /**
   * Resolves a date with several journal pages.
   * keep: keepPageId stays the journal; the others become normal pages.
   * merge: the others' content is appended to keepPageId, then they move to trash.
   */
  async resolveConflict(
    user: User,
    workspaceId: string,
    date: string,
    keepPageId: string,
    mode: 'keep' | 'merge',
  ) {
    const pages = await this.getByDate(user, workspaceId, date);
    const keep = pages.find((p) => p.id === keepPageId);
    if (!keep) throw new NotFoundException('Page is not a journal for that date');
    const others = pages.filter((p) => p.id !== keepPageId);

    const keepPage = await this.pageRepo.findById(keepPageId);
    await this.pageAccessService.validateCanEdit(keepPage, user);

    for (const other of others) {
      const otherPage = await this.pageRepo.findById(other.id, {
        includeContent: true,
      });
      await this.pageAccessService.validateCanEdit(otherPage, user);
      if (mode === 'merge') {
        const content = otherPage.content as any;
        if (content?.content?.length) {
          await this.pageService.updatePageContent(
            keepPageId,
            content,
            'append',
            'json',
            user,
          );
        }
      }
      await this.db
        .deleteFrom('notesJournals')
        .where('pageId', '=', other.id)
        .execute();
      if (mode === 'merge') {
        await this.pageService.removePage(other.id, user.id, workspaceId);
      }
    }
    return { journalDate: date, keptPageId: keepPageId, resolved: others.length };
  }

  /** Other pages created or edited in [start, end) (the client's local day), newest first. */
  async dayActivity(
    user: User,
    workspaceId: string,
    start: string,
    end: string,
  ) {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
      throw new BadRequestException('start and end must be ISO timestamps');
    }
    const rows = await this.db
      .selectFrom('pages as p')
      .innerJoin('spaces as s', 's.id', 'p.spaceId')
      .leftJoin('notesJournals as j', 'j.pageId', 'p.id')
      .select([
        'p.id',
        'p.slugId',
        'p.title',
        'p.icon',
        's.slug as spaceSlug',
        'p.createdAt',
        'p.updatedAt',
      ])
      .where('p.workspaceId', '=', workspaceId)
      .where('p.deletedAt', 'is', null)
      .where('j.id', 'is', null)
      .where(
        'p.spaceId',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(user.id) as any,
      )
      .where((eb) =>
        eb.or([
          eb.and([eb('p.createdAt', '>=', s), eb('p.createdAt', '<', e)]),
          eb.and([eb('p.updatedAt', '>=', s), eb('p.updatedAt', '<', e)]),
        ]),
      )
      .orderBy('p.updatedAt', 'desc')
      .limit(50)
      .execute();

    const created = rows.filter(
      (r) => new Date(r.createdAt) >= s && new Date(r.createdAt) < e,
    );
    const edited = rows.filter((r) => !created.includes(r));
    return { created, edited };
  }

  /** Space for new journals: the configured one, else the first space where the user can create pages. */
  private async resolveJournalSpace(
    user: User,
    workspaceId: string,
  ): Promise<string> {
    const settings = await this.settingsService.get(user, workspaceId);
    const candidates: string[] = [];
    if (settings.journalSpaceId) candidates.push(settings.journalSpaceId);

    const spaces = await this.db
      .selectFrom('spaces')
      .select('id')
      .where('workspaceId', '=', workspaceId)
      .where(
        'id',
        'in',
        this.spaceMemberRepo.getUserSpaceIdsQuery(user.id) as any,
      )
      .orderBy('createdAt', 'asc')
      .execute();
    candidates.push(...spaces.map((s) => s.id));

    for (const spaceId of candidates) {
      const ability = await this.spaceAbility.createForUser(user, spaceId);
      if (ability.can(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
        return spaceId;
      }
    }
    throw new ForbiddenException(
      'No space where you can create pages. Create a space first.',
    );
  }

  /** The "Journal" parent page in the journal space; created on first use. */
  private async resolveJournalParent(
    user: User,
    workspaceId: string,
    spaceId: string,
  ): Promise<string> {
    return executeTx(this.db as unknown as KyselyDB, async (trx) => {
      await sql`select pg_advisory_xact_lock(hashtext(${`notes-journal-parent:${user.id}`}))`.execute(
        trx,
      );
      const settings = await this.settingsService.get(user, workspaceId, trx);
      if (settings.journalParentPageId) {
        const parent = await this.pageRepo.findById(
          settings.journalParentPageId,
          { trx },
        );
        if (parent && !parent.deletedAt && parent.spaceId === spaceId) {
          return parent.id;
        }
      }
      const parent = await this.pageService.create(
        user.id,
        workspaceId,
        { title: JOURNAL_PARENT_TITLE, spaceId, icon: '📓' },
        trx,
      );
      await this.settingsService.patch(
        user,
        workspaceId,
        { journalParentPageId: parent.id },
        trx,
      );
      return parent.id;
    });
  }

  /** Template doc for a new journal: journal template, else page template if enabled, else none. */
  private async resolveTemplate(user: User, workspaceId: string) {
    const settings = await this.settingsService.get(user, workspaceId);
    const ids = [
      settings.journalTemplatePageId,
      settings.pageTemplateEnabled ? settings.pageTemplatePageId : null,
    ].filter(Boolean) as string[];

    for (const id of ids) {
      const page = await this.pageRepo.findById(id, { includeContent: true });
      if (!page || page.deletedAt || page.workspaceId !== workspaceId) continue;
      try {
        await this.pageAccessService.validateCanView(page, user);
      } catch {
        continue;
      }
      if (page.content) return page.content as any;
    }
    return null;
  }
}
