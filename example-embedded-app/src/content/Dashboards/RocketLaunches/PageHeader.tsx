import { Typography, Avatar, Grid } from "@mui/material";
import { useTheme } from "@mui/material/styles";

function PageHeader() {
  const user = {
    name: "Jane Doe",
    avatar: "/static/images/avatars/generic-avatar-image1.png",
  };
  const theme = useTheme();

  return (
    <Grid container alignItems="center">
      <Grid item>
        <Avatar
          sx={{
            mr: 2,
            width: theme.spacing(8),
            height: theme.spacing(8),
          }}
          variant="rounded"
          alt={user.name}
          src={user.avatar}
        />
      </Grid>
      <Grid item>
        <Typography variant="h3" component="h3" gutterBottom>
          Welcome, {user.name}!
        </Typography>
        <Typography variant="subtitle2">
          Manage recent and future rocket launches from here!
        </Typography>
      </Grid>
    </Grid>
  );
}

export default PageHeader;
