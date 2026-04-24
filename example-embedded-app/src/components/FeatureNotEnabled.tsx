import { ReportProblemTwoTone } from "@mui/icons-material";
import { Container, Link, Stack, Typography } from "@mui/material";

interface FeatureNotEnabledProps {
  featureName: string;
  docsUrl: string;
}

function FeatureNotEnabled({ featureName, docsUrl }: FeatureNotEnabledProps) {
  return (
    <Container>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <ReportProblemTwoTone sx={{ color: "orange" }} />
        <Typography variant="body1">
          {featureName} is not enabled for this customer. It's an opt-in feature
          enabled per-customer, and may also need to be turned on for your
          organization — contact Prismatic support. See{" "}
          <Link href={docsUrl} target="_blank" rel="noopener noreferrer">
            docs
          </Link>
          .
        </Typography>
      </Stack>
    </Container>
  );
}

export default FeatureNotEnabled;
