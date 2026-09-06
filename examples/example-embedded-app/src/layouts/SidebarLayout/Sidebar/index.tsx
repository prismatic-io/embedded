import {
  Box,
  Button,
  Divider,
  Drawer,
  darken,
  styled,
  useTheme,
} from "@mui/material";
import { useContext } from "react";
import Logo from "src/components/LogoSign";
import { SidebarContext } from "src/contexts/SidebarContext";
import SidebarMenu from "./SidebarMenu";

const SidebarWrapper = styled(Box)(
  ({ theme }) => `
        width: ${theme.sidebar.width};
        min-width: ${theme.sidebar.width};
        color: ${theme.colors.alpha.trueWhite[70]};
        position: relative;
        z-index: 7;
        height: 100%;
        padding-bottom: 68px;
`,
);

function Sidebar() {
  const { sidebarToggle, toggleSidebar } = useContext(SidebarContext);
  const closeSidebar = () => toggleSidebar();
  const theme = useTheme();

  return (
    <>
      <SidebarWrapper
        sx={{
          display: {
            xs: "none",
            lg: "inline-block",
          },
          position: "fixed",
          left: 0,
          top: 0,
          background: darken(theme.colors.alpha.black[100], 0.5),
          boxShadow: "none",
        }}
      >
        <Box sx={{ height: "100%", overflowY: "auto" }}>
          <Box
            sx={{
              mt: 3,
            }}
          >
            <Box
              sx={{
                mx: 2,
              }}
            >
              <Logo />
            </Box>
          </Box>
          <Divider
            sx={{
              mt: theme.spacing(3),
              mx: theme.spacing(2),
              background: theme.colors.alpha.trueWhite[10],
            }}
          />
          <SidebarMenu />
        </Box>
        <Divider
          sx={{
            background: theme.colors.alpha.trueWhite[10],
          }}
        />
        <Box
          sx={{
            p: 2,
          }}
        >
          <Button
            href="https://prismatic.io/docs/embed/get-started/install-embedded-sdk/"
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="success"
            size="small"
            fullWidth
          >
            Read the Docs
          </Button>
        </Box>
      </SidebarWrapper>
      <Drawer
        sx={{
          boxShadow: `${theme.sidebar.boxShadow}`,
        }}
        anchor={theme.direction === "rtl" ? "right" : "left"}
        open={sidebarToggle}
        onClose={closeSidebar}
        variant="temporary"
        elevation={9}
      >
        <SidebarWrapper
          sx={{
            background: darken(theme.colors.alpha.black[100], 0.5),
          }}
        >
          <Box sx={{ height: "100%", overflowY: "auto" }}>
            <Box
              sx={{
                mt: 3,
              }}
            >
              <Box
                sx={{
                  mx: 2,
                  width: 52,
                }}
              >
                <Logo />
              </Box>
            </Box>
            <Divider
              sx={{
                mt: theme.spacing(3),
                mx: theme.spacing(2),
                background: theme.colors.alpha.trueWhite[10],
              }}
            />
            <SidebarMenu />
          </Box>
        </SidebarWrapper>
      </Drawer>
    </>
  );
}

export default Sidebar;
