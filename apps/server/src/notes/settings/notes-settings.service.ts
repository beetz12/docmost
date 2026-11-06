import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { User } from '@docmost/db/types/entity.types';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { NotesKysely, NotesUserSettings } from '../notes-db.types';

export type NotesSettings = Omit<
  NotesUserSettings,
  'userId' | 'workspaceId' | 'updatedAt' | 'pageTemplateEnabled'
> & { pageTemplateEnabled: boolean };

export type NotesSettingsPatch = Partial<NotesSettings>;

const DEFAULTS: NotesSettings = {
  journalSpaceId: null,
  journalParentPageId: null,
  journalTemplatePageId: null,
  pageTemplatePageId: null,
  pageTemplateEnabled: false,
};

@Injectable()
export class NotesSettingsService {
  private readonly db: NotesKysely;

  constructor(
    @InjectKysely() db: KyselyDB,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {
    this.db = db as unknown as NotesKysely;
  }

  async get(user: User, workspaceId: string, trx?: any): Promise<NotesSettings> {
    const row = await ((trx ?? this.db) as NotesKysely)
      .selectFrom('notesUserSettings')
      .select([
        'journalSpaceId',
        'journalParentPageId',
        'journalTemplatePageId',
        'pageTemplatePageId',
        'pageTemplateEnabled',
      ])
      .where('userId', '=', user.id)
      .where('workspaceId', '=', workspaceId)
      .executeTakeFirst();
    return row ? { ...DEFAULTS, ...row } : { ...DEFAULTS };
  }

  /** Internal write without validation (used by services that already checked access). */
  async patch(
    user: User,
    workspaceId: string,
    values: NotesSettingsPatch,
    trx?: any,
  ): Promise<void> {
    await ((trx ?? this.db) as NotesKysely)
      .insertInto('notesUserSettings')
      .values({ userId: user.id, workspaceId, ...values })
      .onConflict((oc) =>
        oc.column('userId').doUpdateSet({ ...values, updatedAt: new Date() }),
      )
      .execute();
  }

  /** User-facing update: checks every referenced space/page before saving. */
  async update(
    user: User,
    workspaceId: string,
    values: NotesSettingsPatch,
  ): Promise<NotesSettings> {
    const clean: NotesSettingsPatch = {};

    if (values.journalSpaceId !== undefined) {
      if (values.journalSpaceId !== null) {
        const ability = await this.spaceAbility.createForUser(
          user,
          values.journalSpaceId,
        );
        if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
          throw new BadRequestException(
            'You cannot create pages in that space',
          );
        }
      }
      clean.journalSpaceId = values.journalSpaceId;
      // a new space needs its own "Journal" parent page
      clean.journalParentPageId = null;
    }

    for (const key of ['journalTemplatePageId', 'pageTemplatePageId'] as const) {
      const id = values[key];
      if (id === undefined) continue;
      if (id !== null) {
        const page = await this.pageRepo.findById(id);
        if (!page || page.deletedAt || page.workspaceId !== workspaceId) {
          throw new BadRequestException('Template page not found');
        }
        await this.pageAccessService.validateCanView(page, user);
      }
      clean[key] = id;
    }

    if (values.pageTemplateEnabled !== undefined) {
      clean.pageTemplateEnabled = Boolean(values.pageTemplateEnabled);
    }

    if (Object.keys(clean).length > 0) {
      await this.patch(user, workspaceId, clean);
    }
    return this.get(user, workspaceId);
  }
}
