import { Box, Button, Container, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";
import { useRouter } from "next/router";
import Link from "@/components/Link";

const AuthError = () => {
  const router = useRouter();
  const { message } = router.query;
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
      }}
    >
      <Container maxWidth="md">
        <Grid container spacing={2}>
          <Grid size={8}>
            <Typography
              variant="h2"
              sx={{
                mb: 2,
              }}
            >
              An Authentication Error Occurred
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mb: 1,
              }}
            >
              <strong>Error Message</strong>: {message}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                mb: 2,
              }}
            >
              Please reference <strong>README.md</strong> for information on how
              to set up authentication.
            </Typography>
            <Link href="/">
              <Button variant="contained">Back Home</Button>
            </Link>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AuthError;
