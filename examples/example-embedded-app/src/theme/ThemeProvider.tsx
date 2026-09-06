import { ThemeProvider } from "@mui/material";
import type { PropsWithChildren } from "react";
import { PureLightTheme } from "./schemes/PureLightTheme";

const ThemeProviderWrapper = ({ children }: PropsWithChildren) => (
  <ThemeProvider theme={PureLightTheme}>{children}</ThemeProvider>
);

export default ThemeProviderWrapper;
