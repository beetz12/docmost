import {
  fillPlaceholders,
  fillTemplateDoc,
  isJournalEmpty,
  isValidJournalDate,
  journalCreatedAt,
  monthRange,
} from './journal-date.util';

describe('journal-date.util', () => {
  it('validates real calendar dates only', () => {
    expect(isValidJournalDate('2026-11-06')).toBe(true);
    expect(isValidJournalDate('2024-02-29')).toBe(true);
    expect(isValidJournalDate('2026-02-29')).toBe(false);
    expect(isValidJournalDate('2026-13-01')).toBe(false);
    expect(isValidJournalDate('2026-1-01')).toBe(false);
    expect(isValidJournalDate(undefined)).toBe(false);
  });

  it('computes month ranges', () => {
    expect(monthRange('2026-02')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
    expect(monthRange('2024-02')?.end).toBe('2024-02-29');
    expect(monthRange('2026-13')).toBeNull();
    expect(monthRange('nope')).toBeNull();
  });

  it('fills placeholders and leaves unknown ones', () => {
    expect(fillPlaceholders('{{date}} {{ Weekday }} {{x}}', '2026-11-06')).toBe(
      '2026-11-06 Friday {{x}}',
    );
    expect(fillPlaceholders('{{longdate}}', '2026-11-06')).toBe(
      'Friday, 6 November 2026',
    );
  });

  it('fills placeholders in nested text nodes without mutating the template', () => {
    const tpl = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Notes for {{date}}' }],
        },
      ],
    };
    const out = fillTemplateDoc(tpl, '2026-11-06');
    expect(out.content[0].content[0].text).toBe('Notes for 2026-11-06');
    expect(tpl.content[0].content[0].text).toBe('Notes for {{date}}');
    expect(out.content[0].attrs.level).toBe(2);
  });

  it('treats unchanged or blank journals as empty', () => {
    expect(isJournalEmpty('', '')).toBe(true);
    expect(isJournalEmpty('  Plan  ', 'Plan')).toBe(true);
    expect(isJournalEmpty('Plan and more', 'Plan')).toBe(false);
    expect(isJournalEmpty(null, null)).toBe(true);
  });

  it('back-dates created_at only for other days', () => {
    expect(journalCreatedAt('2026-11-06', '2026-11-06')).toBeNull();
    expect(journalCreatedAt('2026-11-01', '2026-11-06')?.toISOString()).toBe(
      '2026-11-01T12:00:00.000Z',
    );
  });
});
