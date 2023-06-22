import {
  Button,
  Card,
  Box,
  Grid,
  Typography,
  useTheme,
  styled,
  Divider,
  alpha,
  ListItem,
  ListItemText,
  List,
  ListItemAvatar,
} from "@mui/material";
import Text from "src/components/Text";
import { Chart } from "src/components/Chart";
import type { ApexOptions } from "apexcharts";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FireTruckIcon from "@mui/icons-material/FireTruck";
import RocketIcon from "@mui/icons-material/Rocket";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

const ListItemAvatarWrapper = styled(ListItemAvatar)(
  ({ theme }) => `
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: ${theme.spacing(2)};
  padding: ${theme.spacing(0.5)};
  border-radius: 60px;
  background: ${
    theme.palette.mode === "dark"
      ? theme.colors.alpha.trueWhite[30]
      : alpha(theme.colors.alpha.black[100], 0.07)
  };
  height: ${theme.spacing(4.5)};
  width: ${theme.spacing(4.5)};
`,
);

function RocketLaunches() {
  const theme = useTheme();

  const chartOptions: ApexOptions = {
    chart: {
      background: "transparent",
      stacked: false,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "60%",
        },
      },
    },
    colors: ["#ff9900", "#1c81c2", "#333", "#5c6ac0"],
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return val + "%";
      },
      style: {
        colors: [theme.colors.alpha.trueWhite[100]],
      },
      background: {
        enabled: true,
        foreColor: theme.colors.alpha.trueWhite[100],
        padding: 8,
        borderRadius: 4,
        borderWidth: 0,
        opacity: 0.3,
        dropShadow: {
          enabled: true,
          top: 1,
          left: 1,
          blur: 1,
          color: theme.colors.alpha.black[70],
          opacity: 0.5,
        },
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 1,
        color: theme.colors.alpha.black[50],
        opacity: 0.5,
      },
    },
    fill: {
      opacity: 1,
    },
    labels: [
      "Grounded",
      "Upcoming Launch",
      "Failure to Launch",
      "Successful Launch",
    ],
    legend: {
      labels: {
        colors: theme.colors.alpha.trueWhite[100],
      },
      show: false,
    },
    stroke: {
      width: 0,
    },
    theme: {
      mode: theme.palette.mode,
    },
  };

  const chartSeries = [10, 20, 25, 45];

  return (
    <Card>
      <Grid spacing={0} container>
        <Grid item xs={12} md={12}>
          <Box p={4}>
            <Typography
              sx={{
                pb: 3,
              }}
              variant="h4"
            >
              Recent and Upcoming Rocket Launches
            </Typography>
            <Box py={4} pr={4} flex={1}>
              <Grid container spacing={1}>
                <Grid sm={1} item />
                <Grid
                  xs={12}
                  sm={4}
                  item
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                >
                  <Chart
                    height={250}
                    options={chartOptions}
                    series={chartSeries}
                    type="donut"
                  />
                </Grid>
                <Grid sm={2} item />
                <Grid xs={12} sm={5} item display="flex" alignItems="center">
                  <List
                    disablePadding
                    sx={{
                      width: "100%",
                    }}
                  >
                    <ListItem disableGutters>
                      <ListItemAvatarWrapper>
                        <RocketIcon />
                      </ListItemAvatarWrapper>
                      <ListItemText
                        primary="Grounded"
                        primaryTypographyProps={{ variant: "h5", noWrap: true }}
                        secondary="Launches on hold"
                        secondaryTypographyProps={{
                          variant: "subtitle2",
                          noWrap: true,
                        }}
                      />
                      <Box>
                        <Typography align="right" variant="h4" noWrap>
                          10%
                        </Typography>
                      </Box>
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemAvatarWrapper>
                        <CalendarMonthIcon />
                      </ListItemAvatarWrapper>
                      <ListItemText
                        primary="Upcoming"
                        primaryTypographyProps={{ variant: "h5", noWrap: true }}
                        secondary="Launches scheduled in the next month"
                        secondaryTypographyProps={{
                          variant: "subtitle2",
                          noWrap: true,
                        }}
                      />
                      <Box>
                        <Typography align="right" variant="h4" noWrap>
                          20%
                        </Typography>
                      </Box>
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemAvatarWrapper>
                        <RocketLaunchIcon />
                      </ListItemAvatarWrapper>
                      <ListItemText
                        primary="Successful"
                        primaryTypographyProps={{ variant: "h5", noWrap: true }}
                        secondary="Successful launches last month"
                        secondaryTypographyProps={{
                          variant: "subtitle2",
                          noWrap: true,
                        }}
                      />
                      <Box>
                        <Typography align="right" variant="h4" noWrap>
                          45%
                        </Typography>
                        <Text color="success">+4.7%</Text>
                      </Box>
                    </ListItem>
                    <ListItem disableGutters>
                      <ListItemAvatarWrapper>
                        <FireTruckIcon />
                      </ListItemAvatarWrapper>
                      <ListItemText
                        primary="Failure"
                        primaryTypographyProps={{ variant: "h5", noWrap: true }}
                        secondary="Failed rocket launches last month"
                        secondaryTypographyProps={{
                          variant: "subtitle2",
                          noWrap: true,
                        }}
                      />
                      <Box>
                        <Typography align="right" variant="h4" noWrap>
                          25%
                        </Typography>
                        <Text color="error">-2.3%</Text>
                      </Box>
                    </ListItem>
                  </List>
                </Grid>
              </Grid>
            </Box>
            <Grid container spacing={3}>
              <Grid sm item>
                <Button fullWidth variant="outlined">
                  New Launch Entry
                </Button>
              </Grid>
              <Grid sm item>
                <Button fullWidth variant="contained">
                  Generate Report
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Grid>
        <Grid
          sx={{
            position: "relative",
          }}
          display="flex"
          alignItems="center"
          item
          xs={12}
          md={6}
        >
          <Box
            component="span"
            sx={{
              display: { xs: "none", md: "inline-block" },
            }}
          >
            <Divider absolute orientation="vertical" />
          </Box>
        </Grid>
      </Grid>
    </Card>
  );
}

export default RocketLaunches;
