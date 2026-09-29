import { Container, Grid } from "@mui/material";
import Head from "next/head";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import PageHeader from "@/content/Dashboards/RocketLaunches/PageHeader";
import RocketLaunches from "@/content/Dashboards/RocketLaunches/RocketLaunches";
import SidebarLayout from "@/layouts/SidebarLayout";

function RocketLaunchDashboard() {
  return (
    <>
      <Head>
        <title>Rocket Launch Dashboard</title>
      </Head>
      <PageTitleWrapper>
        <PageHeader />
      </PageTitleWrapper>
      <Container maxWidth="lg">
        <Grid
          container
          direction="row"
          spacing={4}
          sx={{
            justifyContent: "center",
            alignItems: "stretch",
          }}
        >
          <Grid size={12}>
            <RocketLaunches />
          </Grid>
        </Grid>
      </Container>
    </>
  );
}

RocketLaunchDashboard.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);

export default RocketLaunchDashboard;
