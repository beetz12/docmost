import { useState } from "react";
import { Link } from "react-router-dom";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import {
  Anchor,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from "@mantine/core";
import { buildPageUrl } from "@/features/page/page.utils";
import { JournalCalendar } from "./journal-calendar";
import { useJournalList, useOpenJournal } from "./journal-queries";
import { formatJournalLabel, toIsoDate } from "./journal-date-query";
import { JOURNAL_HOTKEY_LABEL } from "./journal-hotkey";

/** The journal view: month calendar plus a list of journals, newest first. */
export default function JournalsPage() {
  const [includeEmpty, setIncludeEmpty] = useState(false);
  const { data, isLoading } = useJournalList(includeEmpty);
  const openJournal = useOpenJournal();

  return (
    <Container size="md" py="xl">
      <DocumentTitle title="Journal" />
      <Group justify="space-between" mb="lg">
        <Title order={1} size="h3">
          Journal
        </Title>
        <Button
          onClick={() => openJournal.mutate(toIsoDate(new Date()))}
          loading={openJournal.isPending}
        >
          Today ({JOURNAL_HOTKEY_LABEL})
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
        <Paper withBorder p="md" radius="md">
          <JournalCalendar />
          <Text size="xs" c="dimmed" mt="xs">
            Blue dot: journal. Grey: empty journal. Orange: more than one page for that date.
          </Text>
        </Paper>

        <Stack gap="xs">
          <Switch
            label="Show empty journals"
            checked={includeEmpty}
            onChange={(e) => setIncludeEmpty(e.currentTarget.checked)}
          />
          {isLoading && <Loader size="sm" />}
          {data?.items.length === 0 && (
            <Text size="sm" c="dimmed">
              No journals yet.
            </Text>
          )}
          {data?.items.map((j) => (
            <Group key={j.id} justify="space-between" wrap="nowrap">
              <Anchor
                component={Link}
                to={buildPageUrl(j.spaceSlug, j.slugId, j.title ?? undefined)}
                size="sm"
              >
                {formatJournalLabel(j.journalDate)}
                {j.title && j.title !== j.journalDate ? ` · ${j.title}` : ""}
              </Anchor>
              {j.isEmpty && (
                <Badge size="xs" variant="light" color="gray">
                  empty
                </Badge>
              )}
            </Group>
          ))}
        </Stack>
      </SimpleGrid>
    </Container>
  );
}
