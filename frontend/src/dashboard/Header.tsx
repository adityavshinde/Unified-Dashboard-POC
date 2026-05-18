import Breadcrumbs from "@mui/material/Breadcrumbs";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

type HeaderProps = {
  title: string;
  subtitle?: string;
  organization?: string;
};

export function Header({ title, subtitle, organization }: HeaderProps) {
  return (
    <Stack spacing={1}>
      <Breadcrumbs aria-label="breadcrumb">
        <Link underline="hover" color="inherit" href="#">
          Dashboard
        </Link>
        <Typography color="text.primary">{title}</Typography>
      </Breadcrumbs>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Typography component="h1" variant="h4" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {organization && (
          <Chip label={organization} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
        )}
      </Stack>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          {subtitle}
        </Typography>
      )}
    </Stack>
  );
}
