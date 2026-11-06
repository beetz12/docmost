import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Anchor,
  Button,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconAlertTriangle } from "@tabler/icons-react";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils";
import { JournalCalendar } from "./journal-calendar";
import {
  useJournalDayActivity,
  useJournalInfo,
  useResolveJournalConflict,
  useSetJournalDate,
} from "./journal-queries";
import { formatJournalLabel, toIsoDate } from "./journal-date-query";
import { ActivityPage } from "./journal-service";

function PageLinks({ title, pages }: { title: string; pages: ActivityPage[] }) {
  if (pages.length === 0) return null;
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">
        {title}
      </Text>
      {pages.map((p) => (
        <Anchor
          key={p.id}
          component={Link}
          to={buildPageUrl(p.spaceSlug, p.slugId, p.title ?? undefined)}
          size="sm"
          lineClamp={1}
        >
          {p.icon ? `${p.icon} ` : ""}
          {p.title || "Untitled"}
        </Anchor>
      ))}
    </Stack>
  );
}

/** Side panel for the "Journal" aside tab: date, calendar, conflicts and the day's other pages. */
export default function JournalAside() {
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: info } = useJournalInfo(page?.id);
  const journalDate = info?.journalDate ?? null;
  const { data: activity } = useJournalDayActivity(journalDate);
  const setDate = useSetJournalDate();
  const resolve = useResolveJournalConflict();
  const [markDate, setMarkDate] = useState<string | null>(toIsoDate(new Date()));

  if (!page) return null;

  return (
    <Stack gap="md">
      {journalDate ? (
        <>
          <div>
            <Title order={3} size="h5">
              {formatJournalLabel(journalDate)}
            </Title>
            <Text size="xs" c="dimmed">
              Journal
            </Text>
          </div>

          {info?.conflict && (
            <Alert
              color="orange"
              icon={<IconAlertTriangle size={16} />}
              title="More than one journal for this date"
            >
              <Stack gap="xs">
                {info.pages.map((p) => (
                  <Stack key={p.id} gap={4}>
                    <Anchor
                      component={Link}
                      to={buildPageUrl(p.spaceSlug, p.slugId, p.title ?? undefined)}
                      size="sm"
                      fw={p.id === page.id ? 700 : undefined}
                    >
                      {p.title || "Untitled"}
                      {p.id === page.id ? " (this page)" : ""}
                    </Anchor>
                    <Group gap="xs">
                      <Button
                        size="compact-xs"
                        variant="light"
                        loading={resolve.isPending}
                        onClick={() =>
                          resolve.mutate({ date: journalDate, keepPageId: p.id, mode: "keep" })
                        }
                      >
                        Keep this one
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="light"
                        loading={resolve.isPending}
                        onClick={() =>
                          resolve.mutate({ date: journalDate, keepPageId: p.id, mode: "merge" })
                        }
                      >
                        Merge others into this
                      </Button>
                    </Group>
                  </Stack>
                ))}
                <Text size="xs" c="dimmed">
                  Keep: the others become normal pages. Merge: their content is
                  added to the end of the kept page and they move to trash.
                </Text>
              </Stack>
            </Alert>
          )}

          <JournalCalendar selectedDate={journalDate} size="xs" />

          <Divider />
          <PageLinks title="Created that day" pages={activity?.created ?? []} />
          <PageLinks title="Edited that day" pages={activity?.edited ?? []} />
          {activity &&
            activity.created.length === 0 &&
            activity.edited.length === 0 && (
              <Text size="sm" c="dimmed">
                No other pages created or edited that day.
              </Text>
            )}

          <Divider />
          <Group justify="space-between">
            <Anchor component={Link} to="/journals" size="sm">
              All journals
            </Anchor>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              loading={setDate.isPending}
              onClick={() => setDate.mutate({ pageId: page.id, date: null })}
            >
              Turn into normal page
            </Button>
          </Group>
        </>
      ) : (
        <>
          <Text size="sm">This page is not a journal.</Text>
          <DatePickerInput
            label="Journal date"
            value={markDate}
            onChange={(v) => setMarkDate(v ? String(v).slice(0, 10) : null)}
            size="xs"
          />
          <Button
            size="xs"
            disabled={!markDate}
            loading={setDate.isPending}
            onClick={() => markDate && setDate.mutate({ pageId: page.id, date: markDate })}
          >
            Mark as journal for this date
          </Button>
          <Divider />
          <JournalCalendar size="xs" />
          <Anchor component={Link} to="/journals" size="sm">
            All journals
          </Anchor>
        </>
      )}
    </Stack>
  );
}
