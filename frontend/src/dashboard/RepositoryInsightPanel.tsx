import CachedIcon from "@mui/icons-material/Cached";
import CloseIcon from "@mui/icons-material/Close";
import FilterAltOffIcon from "@mui/icons-material/FilterAltOff";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Fade from "@mui/material/Fade";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchRepoInsights,
  type CategoryInsight,
  type Issue,
  type LatestRelease,
  type PullRequestItem,
  type Repository,
} from "../api/client";
import { useAiMode } from "../theme/AiModeContext";
import { InsightsLoading } from "./InsightsLoading";
import { describeLatestMonthTrend } from "./statTrendUtils";
import { TrendInsightBanner } from "./TrendInsightBanner";

const CHART_COLORS = [
  "#1976d2",
  "#d32f2f",
  "#ed6c02",
  "#2e7d32",
  "#9c27b0",
  "#00838f",
  "#6d4c41",
];
const LOADING_DELAY_MS = 150;
const STALE_DAYS = 30;

/** Backend sends months as `YYYY-MM` (UTC). */
function formatMonthLabel(yearMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
  if (!match) return yearMonth;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatReleaseDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function createdYearMonth(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function trendItemLabel(categoryKey: string): string {
  if (categoryKey === "pending_prs" || categoryKey === "stale_prs") return "pull requests opened";
  if (categoryKey === "dependency_alerts") return "alerts";
  if (categoryKey === "stale_issues") return "stale issues opened";
  return "issues opened";
}

function monthRangeLabel(months: string[]): string | null {
  if (months.length === 0) return null;
  const first = formatMonthLabel(months[0]!);
  const last = formatMonthLabel(months[months.length - 1]!);
  return first === last ? first : `${first} – ${last}`;
}

function isPrCategory(key: string): boolean {
  return key === "pending_prs" || key === "stale_prs";
}

function filterCategoryByMonth(category: CategoryInsight, month: string | null): CategoryInsight {
  if (!month) return category;

  if (category.pull_requests?.length) {
    const pull_requests = category.pull_requests.filter(
      pr => createdYearMonth(pr.created_at) === month,
    );
    return { ...category, pull_requests, total: pull_requests.length };
  }

  if (category.issues?.length) {
    const issues = category.issues.filter(issue => createdYearMonth(issue.created_at) === month);
    return { ...category, issues, total: issues.length };
  }

  return category;
}

type RepositoryInsightPanelProps = {
  repo: Repository;
  /** Increment to force refresh from GitHub (bypass server cache). */
  refreshTrigger: number;
  onClose: () => void;
};

function PanelToolbar({
  onClose,
  children,
}: {
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        {children}
      </Stack>
      <Tooltip title="Collapse">
        <IconButton size="small" aria-label="Collapse insights" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

export function RepositoryInsightPanel({ repo, refreshTrigger, onClose }: RepositoryInsightPanelProps) {
  const { aiMode } = useAiMode();
  const [categories, setCategories] = useState<CategoryInsight[]>([]);
  const [latestRelease, setLatestRelease] = useState<LatestRelease | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>("good_first_issues");
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultCategoryKey = useCallback((list: CategoryInsight[]) => {
    return list.find(c => c.total > 0)?.key ?? list[0]?.key ?? "good_first_issues";
  }, []);

  const applyInsights = useCallback(
    (data: Awaited<ReturnType<typeof fetchRepoInsights>>["data"]) => {
      const list = Array.isArray(data.categories) ? data.categories : [];
      setCategories(list);
      setLatestRelease(data.latest_release ?? null);
      setSelectedKey(defaultCategoryKey(list));
      setMonthFilter(null);
    },
    [defaultCategoryKey],
  );

  useEffect(() => {
    const parts = repo.full_name.split("/");
    const owner = parts[0];
    const name = parts[1];
    if (!owner || !name) return;
    let cancelled = false;
    const forceRefresh = refreshTrigger > 0;

    setError(null);
    setFromCache(false);
    setReady(false);
    setCategories([]);
    setLatestRelease(null);
    setMonthFilter(null);
    setShowLoader(forceRefresh);

    let loadingTimer: ReturnType<typeof setTimeout> | undefined;
    if (!forceRefresh) {
      loadingTimer = setTimeout(() => {
        if (!cancelled) setShowLoader(true);
      }, LOADING_DELAY_MS);
    }

    fetchRepoInsights(owner, name, { refresh: forceRefresh, aiMode })
      .then(({ data, fromCache: cached }) => {
        if (cancelled) return;
        clearTimeout(loadingTimer);
        applyInsights(data);
        setFromCache(cached);
        setShowLoader(false);
        setReady(true);
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load insights");
          setShowLoader(false);
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
    };
  }, [repo.full_name, refreshTrigger, aiMode, applyInsights]);

  const safeCategories = categories ?? [];

  const selected = useMemo(
    () => safeCategories.find(c => c.key === selectedKey) ?? safeCategories[0],
    [safeCategories, selectedKey],
  );

  const filteredSelected = useMemo(
    () => (selected ? filterCategoryByMonth(selected, monthFilter) : undefined),
    [selected, monthFilter],
  );

  const pieData = useMemo(
    () =>
      safeCategories.map((c, i) => ({
        id: c.key,
        label: c.label,
        value: c.total,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [safeCategories],
  );

  const hasInsightData = useMemo(
    () => pieData.some(d => d.value > 0) || Boolean(latestRelease?.url),
    [pieData, latestRelease],
  );

  const hasActiveFilters = monthFilter !== null;

  const resetAllFilters = () => {
    setMonthFilter(null);
    setSelectedKey(defaultCategoryKey(safeCategories));
  };

  const selectCategory = (key: string) => {
    setSelectedKey(key);
    setMonthFilter(null);
  };

  const panelShellSx = {
    p: 2,
    bgcolor: "action.hover",
    borderTop: 1,
    borderColor: "divider",
  } as const;

  if (!ready) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
        </PanelToolbar>
        {showLoader ? <InsightsLoading /> : <Box sx={{ minHeight: 16 }} />}
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
        </PanelToolbar>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (safeCategories.length === 0 || !selected || !filteredSelected) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
        </PanelToolbar>
        <Typography variant="body2" color="text.secondary">
          No upstream tracking data is available for this repository.
        </Typography>
      </Box>
    );
  }

  if (!hasInsightData) {
    return (
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
          {fromCache && refreshTrigger === 0 && (
            <Tooltip title="Loaded from server cache (up to 15 min old). Use Refresh for latest data.">
              <Chip icon={<CachedIcon />} label="Cached" size="small" variant="outlined" />
            </Tooltip>
          )}
        </PanelToolbar>
        <Typography variant="body2" color="text.secondary">
          Nothing to show yet — no open good-first issues, bugs, pull requests, stale items, or
          dependency alerts were found for this repository.
        </Typography>
      </Box>
    );
  }

  const months = selected.monthly.map(m => m.month);
  const monthLabels = months.map(formatMonthLabel);
  const monthRange = monthRangeLabel(months);
  const counts = selected.monthly.map(m => m.count);
  const monthTrend = describeLatestMonthTrend(counts, monthLabels, trendItemLabel(selectedKey));
  const selectedBarColor =
    pieData.find(d => d.id === selectedKey)?.color ?? CHART_COLORS[0] ?? "#1976d2";

  const listCount = filteredSelected.total;
  const listTitle = monthFilter
    ? `${selected.label} in ${formatMonthLabel(monthFilter)} (${listCount})`
    : `${selected.label} (${listCount})`;

  return (
    <Fade in timeout={400}>
      <Box sx={panelShellSx}>
        <PanelToolbar onClose={onClose}>
          <Typography variant="subtitle2">Upstream insights</Typography>
          {fromCache && refreshTrigger === 0 && (
            <Tooltip title="Loaded from server cache (up to 15 min old). Use Refresh for latest data.">
              <Chip icon={<CachedIcon />} label="Cached" size="small" variant="outlined" />
            </Tooltip>
          )}
          {latestRelease?.url && (
            <Chip
              component="a"
              href={latestRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              clickable
              size="small"
              variant="outlined"
              label={
                latestRelease.published_at
                  ? `Release ${latestRelease.tag} · ${formatReleaseDate(latestRelease.published_at)}`
                  : `Release ${latestRelease.tag}`
              }
              onClick={e => e.stopPropagation()}
            />
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<FilterAltOffIcon />}
            disabled={!hasActiveFilters}
            onClick={e => {
              e.stopPropagation();
              resetAllFilters();
            }}
          >
            Reset filters
          </Button>
        </PanelToolbar>

        {hasActiveFilters && (
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
            {monthFilter && (
              <Chip
                size="small"
                label={`Month: ${formatMonthLabel(monthFilter)}`}
                onDelete={() => setMonthFilter(null)}
              />
            )}
            <Chip size="small" color="primary" variant="outlined" label={selected.label} />
          </Stack>
        )}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" gutterBottom>
              Workload mix — click a segment
            </Typography>
            <PieChart
              series={[
                {
                  data: pieData.filter(d => d.value > 0),
                  innerRadius: 50,
                  outerRadius: 90,
                  paddingAngle: 2,
                  cornerRadius: 3,
                  highlightScope: { fade: "global", highlight: "item" },
                  faded: { additionalRadius: -8 },
                },
              ]}
              height={220}
              onItemClick={(_e, item) => {
                const slice = pieData.filter(d => d.value > 0);
                const entry = item?.dataIndex != null ? slice[item.dataIndex] : undefined;
                if (entry) {
                  selectCategory(String(entry.id));
                }
              }}
            />
            {(selectedKey === "stale_prs" || selectedKey === "stale_issues") && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Stale = no GitHub activity for {STALE_DAYS}+ days
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Typography variant="subtitle2" gutterBottom>
              {selected.label} opened by month
            </Typography>
            {monthRange && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                {monthRange} · by creation date · click a bar to filter the list below
              </Typography>
            )}
            {monthTrend && <TrendInsightBanner insight={monthTrend} color={selectedBarColor} />}
            {months.length > 0 ? (
              <>
                <BarChart
                  xAxis={[{ scaleType: "band", data: monthLabels }]}
                  series={[
                    {
                      data: counts,
                      label: selected.label,
                      color: selectedBarColor,
                      barLabel: "value",
                      barLabelPlacement: "outside",
                    },
                  ]}
                  height={220}
                  margin={{ left: 40, right: 12, top: 20, bottom: 48 }}
                  onItemClick={(_e, item) => {
                    if (item?.dataIndex != null && months[item.dataIndex]) {
                      setMonthFilter(months[item.dataIndex]!);
                    }
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Each bar is how many were opened that month. Click a bar to filter the list, or use
                  Reset filters to show all months.
                </Typography>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No dated items for this category.
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Typography variant="subtitle2" gutterBottom>
              {listTitle}
            </Typography>
            <List dense disablePadding sx={{ maxHeight: 200, overflow: "auto" }}>
              <CategoryItemList category={filteredSelected} />
            </List>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
}

const COMPLEXITY_CONFIG: Record<string, { label: string; color: "success" | "warning" | "error"; tooltip: string }> = {
  beginner: { label: "Beginner", color: "success", tooltip: "Good for newcomers — simple changes like docs, config, or small fixes" },
  intermediate: { label: "Intermediate", color: "warning", tooltip: "Moderate difficulty — requires codebase familiarity and some debugging" },
  advanced: { label: "Advanced", color: "error", tooltip: "Complex — involves architecture, performance, or deep domain knowledge" },
};

function ComplexityChip({ complexity }: { complexity?: string }) {
  if (!complexity) return null;
  const config = COMPLEXITY_CONFIG[complexity];
  if (!config) return null;
  return (
    <Tooltip title={config.tooltip}>
      <Chip
        label={config.label}
        color={config.color}
        size="small"
        variant="outlined"
        sx={{ ml: 1, fontWeight: 600, fontSize: "0.7rem", height: 22 }}
      />
    </Tooltip>
  );
}

function CategoryItemList({ category }: { category: CategoryInsight }) {
  if (isPrCategory(category.key)) {
    if (!category.pull_requests?.length) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No items match the current filters.
        </Typography>
      );
    }
    return (
      <>
        {category.pull_requests.map((pr: PullRequestItem) => (
          <ListItem
            key={pr.id}
            divider
            secondaryAction={
              <IconButton
                component="a"
                href={pr.html_url}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                aria-label="Open on GitHub"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            }
          >
            <ListItemText
              primary={
                <Link href={pr.html_url} target="_blank" rel="noopener noreferrer" underline="hover">
                  #{pr.number} {pr.title}
                </Link>
              }
            />
          </ListItem>
        ))}
      </>
    );
  }

  if (category.key === "dependency_alerts") {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        {category.total} open Dependabot alert(s). Enable GITHUB_TOKEN for alert details.
      </Typography>
    );
  }

  if (!category.issues?.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        No items match the current filters.
      </Typography>
    );
  }

  return (
    <>
      {category.issues.map((issue: Issue) => (
        <ListItem
          key={issue.id}
          divider
          secondaryAction={
            <IconButton
              component="a"
              href={issue.html_url}
              target="_blank"
              rel="noopener noreferrer"
              size="small"
              aria-label="Open on GitHub"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          }
        >
          <ListItemText
            primary={
              <Stack direction="row" alignItems="center" flexWrap="wrap">
                <Link href={issue.html_url} target="_blank" rel="noopener noreferrer" underline="hover">
                  #{issue.number} {issue.title}
                </Link>
                <ComplexityChip complexity={issue.complexity} />
              </Stack>
            }
          />
        </ListItem>
      ))}
    </>
  );
}
