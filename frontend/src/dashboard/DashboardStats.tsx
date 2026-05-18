import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import BugReportOutlinedIcon from "@mui/icons-material/BugReportOutlined";
import CallMergeOutlinedIcon from "@mui/icons-material/CallMergeOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import StarIcon from "@mui/icons-material/Star";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha, type Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import type { Repository } from "../api/client";
import { useStatCardsPreferences } from "../theme/StatCardsPreferencesContext";
import { useAnimatedCount } from "./useAnimatedCount";

type DashboardStatsProps = {
  repositories: Repository[];
  organization: string;
};

type PaletteKey = "primary" | "secondary" | "warning" | "error";

type StatDef = {
  label: string;
  icon: ReactNode;
  paletteKey: PaletteKey;
  value: number;
};

function statCardSx(theme: Theme, paletteKey: PaletteKey) {
  const color = theme.palette[paletteKey].main;
  return {
    height: "100%",
    cursor: "default",
    userSelect: "none",
    borderColor: alpha(color, theme.palette.mode === "light" ? 0.28 : 0.4),
    background: `linear-gradient(145deg, ${alpha(color, theme.palette.mode === "light" ? 0.07 : 0.16)} 0%, ${theme.palette.background.paper} 72%)`,
  };
}

function iconBoxSx(theme: Theme, paletteKey: PaletteKey) {
  const color = theme.palette[paletteKey].main;
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 2,
    bgcolor: alpha(color, theme.palette.mode === "light" ? 0.12 : 0.22),
    color,
  };
}

function AnimatedStatValue({ value }: { value: number }) {
  const animated = useAnimatedCount(value);
  return (
    <Typography
      variant="h5"
      component="div"
      sx={{
        fontWeight: 700,
        lineHeight: 1.2,
        fontVariantNumeric: "tabular-nums",
        textAlign: "center",
      }}
    >
      {animated.toLocaleString()}
    </Typography>
  );
}

function StatCard({
  icon,
  label,
  value,
  paletteKey,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  paletteKey: PaletteKey;
}) {
  return (
    <Card variant="outlined" sx={theme => statCardSx(theme, paletteKey)}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 1,
          }}
        >
          <Box sx={theme => iconBoxSx(theme, paletteKey)}>{icon}</Box>
          <Box sx={{ width: "100%" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", textTransform: "uppercase", letterSpacing: 0.6 }}
            >
              {label}
            </Typography>
            <AnimatedStatValue value={value} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function openPullRequests(repo: Repository): number {
  return repo.open_pull_requests_count ?? 0;
}

export function DashboardStats({ repositories, organization }: DashboardStatsProps) {
  const { showStats, toggleShowStats } = useStatCardsPreferences();

  const totalStars = repositories.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalIssues = repositories.reduce((sum, r) => sum + r.open_issues_count, 0);
  const totalOpenPRs = repositories.reduce((sum, r) => sum + openPullRequests(r), 0);

  const stats: StatDef[] = [
    {
      label: `${organization} repos`,
      icon: <FolderOutlinedIcon />,
      paletteKey: "primary",
      value: repositories.length,
    },
    {
      label: "Total stars",
      icon: <StarIcon />,
      paletteKey: "warning",
      value: totalStars,
    },
    {
      label: "Open PRs",
      icon: <CallMergeOutlinedIcon />,
      paletteKey: "secondary",
      value: totalOpenPRs,
    },
    {
      label: "Open issues",
      icon: <BugReportOutlinedIcon />,
      paletteKey: "error",
      value: totalIssues,
    },
  ];

  return (
    <Box sx={{ mb: showStats ? 2 : 1, cursor: "default" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mb: showStats ? 1.25 : 0,
        }}
      >
        <Tooltip title={showStats ? "Hide overview stats" : "Show overview stats"}>
          <IconButton
            size="small"
            aria-label={showStats ? "Hide overview stats" : "Show overview stats"}
            aria-pressed={showStats}
            onClick={toggleShowStats}
            sx={theme => ({
              border: 1,
              borderColor: showStats ? "primary.main" : "divider",
              background: showStats
                ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.12)}, ${alpha(theme.palette.secondary.main, 0.12)})`
                : "transparent",
              "&:hover": {
                borderColor: "primary.main",
                boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
              },
            })}
          >
            <AutoAwesomeOutlinedIcon fontSize="small" color={showStats ? "primary" : "action"} />
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={showStats} timeout={300} unmountOnExit>
        <Grid container spacing={2}>
          {stats.map(stat => (
            <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                paletteKey={stat.paletteKey}
              />
            </Grid>
          ))}
        </Grid>
      </Collapse>
    </Box>
  );
}
