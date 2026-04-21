import AddTwoToneIcon from "@mui/icons-material/AddTwoTone";
import { Button, Grid, Typography } from "@mui/material";
import type { FC } from "react";

interface PageTitleProps {
  heading?: string;
  subHeading?: string;
  docs?: string;
}

const PageTitle: FC<PageTitleProps> = ({
  heading = "",
  subHeading = "",
  docs = "",
}) => {
  return (
    <Grid
      container
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Grid>
        <Typography variant="h3" component="h3" gutterBottom>
          {heading}
        </Typography>
        <Typography variant="subtitle2">{subHeading}</Typography>
      </Grid>
      <Grid>
        <Button
          href={docs}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mt: { xs: 2, md: 0 } }}
          variant="contained"
          startIcon={<AddTwoToneIcon fontSize="small" />}
        >
          {heading} Documentation
        </Button>
      </Grid>
    </Grid>
  );
};

export default PageTitle;
