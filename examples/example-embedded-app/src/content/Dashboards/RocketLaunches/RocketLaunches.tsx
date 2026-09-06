import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FireTruckIcon from "@mui/icons-material/FireTruck";
import RocketIcon from "@mui/icons-material/Rocket";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import {
  alpha,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  styled,
  Typography,
  useTheme,
} from "@mui/material";
import type { ApexOptions } from "apexcharts";
import { Chart } from "src/components/Chart";
import Text from "src/components/Text";

const ListItemAvatarWrapper = styled(ListItemAvatar)(
  ({ theme }) => `
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: ${theme.spacing(2)};
  padding: ${theme.spacing(0.5)};
  border-radius: 60px;
  background: ${alpha(theme.colors.alpha.black[100], 0.07)};
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
      formatter: (val) => `${val}%`,
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
      mode: "light",
    },
  };

  const chartSeries = [10, 20, 25, 45];

  return (
    <Card>
      <Grid spacing={0} container>
        <Grid
          size={{
            xs: 12,
            md: 12,
          }}
        >
          <Box
            sx={{
              p: 4,
            }}
          >
            <Typography
              sx={{
                pb: 3,
              }}
              variant="h4"
            >
              Recent and Upcoming Rocket Launches
            </Typography>
            <Box
              sx={{
                py: 4,
                pr: 4,
                flex: 1,
              }}
            >
              <Grid container spacing={1}>
                <Grid
                  size={{
                    sm: 1,
                  }}
                />
                <Grid
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  size={{
                    xs: 12,
                    sm: 4,
                  }}
                >
                  <Chart
                    height={250}
                    options={chartOptions}
                    series={chartSeries}
                    type="donut"
                  />
                </Grid>
                <Grid
                  size={{
                    sm: 2,
                  }}
                />
                <Grid
                  sx={{
                    display: "flex",
                    alignItems: "center",
                  }}
                  size={{
                    xs: 12,
                    sm: 5,
                  }}
                >
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
                        secondary="Launches on hold"
                        slotProps={{
                          primary: { variant: "h5", noWrap: true },

                          secondary: {
                            variant: "subtitle2",
                            noWrap: true,
                          },
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
                        secondary="Launches scheduled in the next month"
                        slotProps={{
                          primary: { variant: "h5", noWrap: true },

                          secondary: {
                            variant: "subtitle2",
                            noWrap: true,
                          },
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
                        secondary="Successful launches last month"
                        slotProps={{
                          primary: { variant: "h5", noWrap: true },

                          secondary: {
                            variant: "subtitle2",
                            noWrap: true,
                          },
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
                        secondary="Failed rocket launches last month"
                        slotProps={{
                          primary: { variant: "h5", noWrap: true },

                          secondary: {
                            variant: "subtitle2",
                            noWrap: true,
                          },
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
              <Grid
                size={{
                  sm: "grow",
                }}
              >
                <Button fullWidth variant="outlined">
                  New Launch Entry
                </Button>
              </Grid>
              <Grid
                size={{
                  sm: "grow",
                }}
              >
                <Button fullWidth variant="contained">
                  Generate Report
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Grid>
        <Grid
          sx={{
            display: "flex",
            alignItems: "center",
            position: "relative",
          }}
          size={{
            xs: 12,
            md: 6,
          }}
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
