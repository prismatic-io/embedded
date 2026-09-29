import { alpha, Box, useTheme } from "@mui/material";
import type { FC, ReactNode } from "react";

import Sidebar from "./Sidebar";

interface SidebarLayoutProps {
  children?: ReactNode;
  titleMarginBottom?: number;
}

const SidebarLayout: FC<SidebarLayoutProps> = ({
  children,
  titleMarginBottom,
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",

        ".MuiPageTitle-wrapper": {
          background: theme.colors.alpha.white[50],
          marginBottom: titleMarginBottom
            ? `${theme.spacing(titleMarginBottom)}`
            : null,
          boxShadow: `0px 2px 4px -3px ${alpha(
            theme.colors.alpha.black[100],
            0.1,
          )}, 0px 5px 12px -4px ${alpha(theme.colors.alpha.black[100], 0.05)}`,
          borderBottom: `1px solid ${theme.colors.alpha.black[30]}`,
        },
      }}
    >
      <Sidebar />
      <Box
        sx={{
          position: "relative",
          zIndex: 5,
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          [theme.breakpoints.up("lg")]: {
            ml: `${theme.sidebar.width}`,
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default SidebarLayout;
