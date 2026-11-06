import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class JournalDateDto {
  @Matches(DATE)
  date: string;
}

export class OpenJournalDto extends JournalDateDto {
  // the client's local date; decides whether created_at is back/forward-dated
  @IsOptional()
  @Matches(DATE)
  today?: string;
}

export class JournalMonthDto {
  @Matches(/^\d{4}-\d{2}$/)
  month: string;
}

export class JournalListDto {
  @IsOptional()
  @IsBoolean()
  includeEmpty?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Matches(DATE)
  before?: string;
}

export class JournalPageIdDto {
  @IsUUID()
  pageId: string;
}

export class SetJournalDateDto extends JournalPageIdDto {
  // null turns the journal back into a normal page
  @ValidateIf((o) => o.date !== null)
  @Matches(DATE)
  date: string | null;
}

export class ResolveJournalConflictDto extends JournalDateDto {
  @IsUUID()
  keepPageId: string;

  @IsIn(['keep', 'merge'])
  mode: 'keep' | 'merge';
}

export class JournalDayActivityDto {
  @IsISO8601()
  start: string;

  @IsISO8601()
  end: string;
}

export class UpdateNotesSettingsDto {
  @IsOptional()
  @ValidateIf((o) => o.journalSpaceId !== null)
  @IsUUID()
  journalSpaceId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.journalTemplatePageId !== null)
  @IsUUID()
  journalTemplatePageId?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.pageTemplatePageId !== null)
  @IsUUID()
  pageTemplatePageId?: string | null;

  @IsOptional()
  @IsBoolean()
  pageTemplateEnabled?: boolean;
}

