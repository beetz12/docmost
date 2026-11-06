import { Module } from '@nestjs/common';
import { PageModule } from '../core/page/page.module';
import { JournalController } from './journal/journal.controller';
import { JournalService } from './journal/journal.service';
import { NotesSettingsController } from './settings/notes-settings.controller';
import { NotesSettingsService } from './settings/notes-settings.service';

/**
 * Notes fork (beetz12/docmost): features built from the clean-room spec.
 * Everything lives under src/notes so upstream Docmost can still be merged.
 */
@Module({
  imports: [PageModule],
  controllers: [JournalController, NotesSettingsController],
  providers: [JournalService, NotesSettingsService],
  exports: [JournalService, NotesSettingsService],
})
export class NotesModule {}
