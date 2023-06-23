import { Grid } from "@mui/material";
import ReactMarkdown from "react-markdown";

interface ExampleHeaderProps {
  markdown: string;
}

function ExampleHeader({ markdown }: ExampleHeaderProps) {
  return (
    <Grid container alignItems="center">
      <Grid item>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </Grid>
    </Grid>
  );
}

export default ExampleHeader;
