import Head from "next/head";

import SidebarLayout from "@/layouts/SidebarLayout";

import PageHeader from "@/content/Dashboards/RocketLaunches/PageHeader";
import PageTitleWrapper from "@/components/PageTitleWrapper";
import { Container, Grid } from "@mui/material";
import Footer from "@/components/Footer";

import RocketLaunches from "@/content/Dashboards/RocketLaunches/RocketLaunches";

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
          justifyContent="center"
          alignItems="stretch"
          spacing={4}
        >
          <Grid item xs={12}>
            <RocketLaunches />
          </Grid>
        </Grid>
      </Container>
      <Footer />
    </>
  );
}

RocketLaunchDashboard.getLayout = (page) => (
  <SidebarLayout titleMarginBottom={4}>{page}</SidebarLayout>
);

export default RocketLaunchDashboard;
