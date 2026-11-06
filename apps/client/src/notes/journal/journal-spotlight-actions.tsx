import { Spotlight } from "@mantine/spotlight";
import { Group, Text } from "@mantine/core";
import { IconCalendarEvent } from "@tabler/icons-react";
import { useMemo } from "react";
import { useOpenJournal } from "./journal-queries";
import { formatJournalLabel, parseJournalDateQuery } from "./journal-date-query";

/**
 * Journal date suggestions for the quick search box. "yest" offers yesterday's
 * journal, an empty box offers today's. Opening creates the journal if missing.
 */
export function JournalSpotlightActions({ query }: { query: string }) {
  const openJournal = useOpenJournal();
  const suggestions = useMemo(() => parseJournalDateQuery(query), [query]);
  if (suggestions.length === 0) return null;

  return (
    <Spotlight.ActionsGroup label="Journal">
      {suggestions.map((s) => (
        <Spotlight.Action
          key={s.date}
          data-journal-date={s.date}
          onClick={() => openJournal.mutate(s.date)}
        >
          <Group wrap="nowrap" w="100%">
            <IconCalendarEvent size={18} />
            <div style={{ flex: 1 }}>
              <Text size="sm">{s.label}</Text>
              <Text size="xs" c="dimmed">
                {formatJournalLabel(s.date)}
              </Text>
            </div>
          </Group>
        </Spotlight.Action>
      ))}
    </Spotlight.ActionsGroup>
  );
}
