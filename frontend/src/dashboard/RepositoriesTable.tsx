import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import StarIcon from "@mui/icons-material/Star";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type Theme } from "@mui/material/styles";
import { Fragment, useCallback, useRef, useState, type ReactNode } from "react";
import type { Repository } from "../api/client";
import { RepositoryInsightPanel } from "./RepositoryInsightPanel";

type RepositoriesTableProps = {
  repositories: Repository[];
};

/** App bar + sticky table header clearance when scrolling an expanded row into view. */
const SCROLL_TOP_OFFSET = 136;

function scrollRowIntoContainer(container: HTMLElement, row: HTMLElement, offset: number) {
  const containerTop = container.getBoundingClientRect().top;
  const rowTop = row.getBoundingClientRect().top;
  const next = container.scrollTop + (rowTop - containerTop) - offset;
  container.scrollTo({ top: Math.max(0, next), behavior: "smooth" });
}

const tableHeadCellSx = {
  fontWeight: 600,
  bgcolor: "background.paper",
  backgroundImage: "none",
  borderBottom: 1,
  borderColor: "divider",
  cursor: "default",
  zIndex: 2,
} as const;

/** Per-mode accents tuned for readable chips on light/dark surfaces. */
const LANGUAGE_PALETTES: Record<string, { light: string; dark: string }> = {
  Go: { light: "#00758D", dark: "#5BC0DE" },
  TypeScript: { light: "#235A97", dark: "#79B8FF" },
  Python: { light: "#2D6A9F", dark: "#79B8FF" },
  Shell: { light: "#3D7C3A", dark: "#8FD14F" },
  JavaScript: { light: "#9A6700", dark: "#FFD666" },
  YAML: { light: "#A31621", dark: "#FF8A80" },
  Rust: { light: "#A0410D", dark: "#FF9F69" },
  Java: { light: "#B07200", dark: "#FFC266" },
  Markdown: { light: "#455A64", dark: "#B0BEC5" },
  HCL: { light: "#5C4D9E", dark: "#CE93D8" },
  Makefile: { light: "#5D4037", dark: "#BCAAA4" },
};

function languageAccent(theme: Theme, language?: string): string {
  if (!language) return theme.palette.primary.main;
  const palette = LANGUAGE_PALETTES[language];
  if (!palette) {
    return theme.palette.mode === "light" ? theme.palette.text.secondary : theme.palette.text.primary;
  }
  return theme.palette.mode === "light" ? palette.light : palette.dark;
}

function languageChipSx(theme: Theme, language: string) {
  const accent = languageAccent(theme, language);
  const isLight = theme.palette.mode === "light";
  return {
    fontWeight: 600,
    color: accent,
    borderColor: alpha(accent, isLight ? 0.55 : 0.7),
    bgcolor: alpha(accent, isLight ? 0.1 : 0.2),
  };
}

function languageAvatarSx(theme: Theme, language?: string) {
  const accent = languageAccent(theme, language);
  const isLight = theme.palette.mode === "light";
  return {
    fontWeight: 700,
    color: accent,
    bgcolor: alpha(accent, isLight ? 0.14 : 0.24),
  };
}

function MetricCell({
  icon,
  value,
  iconColor,
}: {
  icon: ReactNode;
  value: number;
  iconColor: string;
}) {
  return (
    <TableCell align="right">
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          justifyContent: "flex-end",
        }}
      >
        <Box component="span" sx={{ display: "flex", color: iconColor, opacity: 0.95 }}>
          {icon}
        </Box>
        <Typography
          variant="body2"
          component="span"
          sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}
        >
          {value.toLocaleString()}
        </Typography>
      </Box>
    </TableCell>
  );
}

export function RepositoriesTable({ repositories }: RepositoriesTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshByRepo, setRefreshByRepo] = useState<Record<number, number>>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());

  const setRowRef = (id: number) => (el: HTMLTableRowElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };

  const scrollExpandedRowIntoView = useCallback((id: number) => {
    const container = tableContainerRef.current;
    const row = rowRefs.current.get(id);
    if (!container || !row) return;
    requestAnimationFrame(() => {
      scrollRowIntoContainer(container, row, SCROLL_TOP_OFFSET);
    });
  }, []);

  const toggle = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const collapse = () => setExpandedId(null);

  const handleRefresh = (repo: Repository, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedId(repo.id);
    setRefreshByRepo(prev => ({
      ...prev,
      [repo.id]: (prev[repo.id] ?? 0) + 1,
    }));
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: theme =>
          theme.palette.mode === "light" ? "0 2px 12px rgba(0,0,0,0.06)" : "0 2px 12px rgba(0,0,0,0.35)",
      }}
    >
      <TableContainer ref={tableContainerRef} sx={{ flex: 1, overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell width={48} sx={tableHeadCellSx} />
              <TableCell sx={tableHeadCellSx}>Repository</TableCell>
              <TableCell sx={tableHeadCellSx}>Description</TableCell>
              <TableCell sx={tableHeadCellSx}>Language</TableCell>
              <TableCell align="right" sx={{ ...tableHeadCellSx, whiteSpace: "nowrap" }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
                  <StarIcon sx={{ fontSize: 16, color: "#f5a524" }} />
                  Stars
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ ...tableHeadCellSx, whiteSpace: "nowrap" }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
                  <CallMergeOutlinedIcon sx={{ fontSize: 16, color: "#9c27b0" }} />
                  Open PRs
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ ...tableHeadCellSx, whiteSpace: "nowrap" }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
                  <BugReportOutlinedIcon sx={{ fontSize: 16, color: "warning.main" }} />
                  Issues
                </Box>
              </TableCell>
              <TableCell width={52} align="center" sx={tableHeadCellSx}>
                <Tooltip title="Refresh fetches latest GitHub data and bypasses the 15-minute cache">
                  <RefreshIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {repositories.map(repo => {
              const open = expandedId === repo.id;
              const refreshTrigger = refreshByRepo[repo.id] ?? 0;
              return (
                <Fragment key={repo.id}>
                  <TableRow
                    ref={setRowRef(repo.id)}
                    hover
                    selected={open}
                    sx={{
                      cursor: "pointer",
                      scrollMarginTop: `${SCROLL_TOP_OFFSET}px`,
                      "&.Mui-selected": {
                        bgcolor: theme =>
                          theme.palette.mode === "light"
                            ? "rgba(25, 118, 210, 0.06)"
                            : "rgba(144, 202, 249, 0.08)",
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: theme =>
                          theme.palette.mode === "light"
                            ? "rgba(25, 118, 210, 0.1)"
                            : "rgba(144, 202, 249, 0.12)",
                      },
                    }}
                    onClick={() => toggle(repo.id)}
                  >
                    <TableCell onClick={e => e.stopPropagation()}>
                      <Tooltip title={open ? "Collapse insights" : "Expand insights"}>
                        <IconButton
                          size="small"
                          aria-label={open ? "Collapse insights" : "Expand insights"}
                          aria-expanded={open}
                          onClick={() => toggle(repo.id)}
                        >
                          {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar
                          sx={theme => ({
                            width: 34,
                            height: 34,
                            fontSize: 14,
                            ...languageAvatarSx(theme, repo.language),
                          })}
                        >
                          {repo.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {repo.name}
                            </Typography>
                            <Tooltip title="Open on GitHub">
                              <IconButton
                                component="a"
                                href={repo.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                                aria-label={`Open ${repo.name} on GitHub`}
                                onClick={e => e.stopPropagation()}
                                sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}
                              >
                                <OpenInNewIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                          >
                            <GitHubIcon sx={{ fontSize: 12 }} />
                            {repo.full_name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography variant="body2" noWrap title={repo.description ?? ""} color={repo.description ? "text.primary" : "text.disabled"}>
                        {repo.description || "No description"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {repo.language ? (
                        <Chip
                          label={repo.language}
                          size="small"
                          variant="outlined"
                          sx={theme => languageChipSx(theme, repo.language!)}
                        />
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <MetricCell
                      icon={<StarIcon sx={{ fontSize: 18 }} />}
                      value={repo.stargazers_count}
                      iconColor="#f5a524"
                    />
                    <MetricCell
                      icon={<CallMergeOutlinedIcon sx={{ fontSize: 17 }} />}
                      value={repo.open_pull_requests_count ?? 0}
                      iconColor="#9c27b0"
                    />
                    <MetricCell
                      icon={<BugReportOutlinedIcon sx={{ fontSize: 17 }} />}
                      value={repo.open_issues_count}
                      iconColor="warning.main"
                    />
                    <TableCell align="center" onClick={e => e.stopPropagation()}>
                      <Tooltip title="Refresh insights from GitHub (bypasses cache)">
                        <IconButton
                          size="small"
                          aria-label="Refresh repository insights"
                          onClick={e => handleRefresh(repo, e)}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ p: 0, borderBottom: open ? undefined : 0 }}>
                      <Collapse
                        in={open}
                        timeout="auto"
                        unmountOnExit
                        onEntered={() => scrollExpandedRowIntoView(repo.id)}
                      >
                        {open && (
                          <RepositoryInsightPanel
                            repo={repo}
                            refreshTrigger={refreshTrigger}
                            onClose={collapse}
                          />
                        )}
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
