import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { JournalService } from './journal.service';
import {
  JournalDateDto,
  JournalDayActivityDto,
  JournalListDto,
  JournalMonthDto,
  JournalPageIdDto,
  OpenJournalDto,
  ResolveJournalConflictDto,
  SetJournalDateDto,
} from './journal.dto';

@UseGuards(JwtAuthGuard)
@Controller('notes/journals')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @HttpCode(HttpStatus.OK)
  @Post('open')
  open(
    @Body() dto: OpenJournalDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.open(user, workspace.id, dto.date, dto.today);
  }

  @HttpCode(HttpStatus.OK)
  @Post('by-date')
  byDate(
    @Body() dto: JournalDateDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService
      .getByDate(user, workspace.id, dto.date)
      .then((items) => ({ items, conflict: items.length > 1 }));
  }

  @HttpCode(HttpStatus.OK)
  @Post('month')
  month(
    @Body() dto: JournalMonthDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.month(user, workspace.id, dto.month);
  }

  @HttpCode(HttpStatus.OK)
  @Post('list')
  list(
    @Body() dto: JournalListDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.list(user, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  info(
    @Body() dto: JournalPageIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.info(user, workspace.id, dto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('set-date')
  setDate(
    @Body() dto: SetJournalDateDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.setDate(user, workspace.id, dto.pageId, dto.date);
  }

  @HttpCode(HttpStatus.OK)
  @Post('resolve')
  resolve(
    @Body() dto: ResolveJournalConflictDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.resolveConflict(
      user,
      workspace.id,
      dto.date,
      dto.keepPageId,
      dto.mode,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('day-activity')
  dayActivity(
    @Body() dto: JournalDayActivityDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.journalService.dayActivity(user, workspace.id, dto.start, dto.end);
  }
}
