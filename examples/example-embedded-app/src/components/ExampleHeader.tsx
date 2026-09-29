import { Grid } from "@mui/material";
import ReactMarkdown from "react-markdown";

interface ExampleHeaderProps {
  markdown: string;
}

function ExampleHeader({ markdown }: ExampleHeaderProps) {
  return (
    <Grid
      container
      sx={{
        alignItems: "center",
      }}
    >
      <Grid>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </Grid>
    </Grid>
  );
}

export default ExampleHeader;
