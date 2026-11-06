import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { NotesSettingsService } from './notes-settings.service';
import { UpdateNotesSettingsDto } from '../journal/journal.dto';

@UseGuards(JwtAuthGuard)
@Controller('notes/settings')
export class NotesSettingsController {
  constructor(private readonly settingsService: NotesSettingsService) {}

  @HttpCode(HttpStatus.OK)
  @Post('get')
  get(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.settingsService.get(user, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  update(
    @Body() dto: UpdateNotesSettingsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.settingsService.update(user, workspace.id, dto);
  }
}
