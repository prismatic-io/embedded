/* eslint-disable @next/next/no-img-element */
import React from "react";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/router";
import Link from "next/link";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { ListSubheader, ListItemButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import * as Icons from "@mui/icons-material/";

const drawerWidth = 240;
const AppDrawer: React.FC<{
  variant: "temporary" | "persistent";
  open: boolean;
  toggleOpen: () => void;
}> = ({ variant, open, toggleOpen }) => {
  const theme = useTheme();
  const router = useRouter();
  const { pathname } = router;

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={() => {
        toggleOpen();
      }}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: `${drawerWidth}px`,
        transition: theme.transitions.create("margin", {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        ...(!open && {
          marginLeft: `-${drawerWidth}px`,
        }),
        backgroundColor: "#546e7a",
        color: "white",
        [`& .MuiDrawer-paper`]: {
          ...(!open && {
            transition: theme.transitions.create("margin", {
              easing: theme.transitions.easing.easeOut,
              duration: 1000,
            }),
            marginLeft: `-${drawerWidth}px`,
          }),
          borderRight: `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
          backgroundColor: "inherit",
          color: "inherit",
        },
        [`& ul > li`]: {
          backgroundColor: "inherit",
          color: "inherit",
        },
      }}
      PaperProps={{
        sx: { position: "relative !important" },
      }}
      anchor="left"
    >
      <List
        disablePadding
        sx={{
          pt: 2,
          "& .MuiListItemButton-root": {
            mx: 1,
            borderRadius: theme.shape.borderRadius,
            paddingLeft: 4,
            paddingRight: 4,
            "&.Mui-selected": {
              backgroundColor: alpha(theme.palette.primary.main, 0.6),
              color: theme.palette.primary.contrastText,
              "& svg": {
                color: theme.palette.primary.contrastText,
              },
            },
            ":hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.9),
              color: theme.palette.primary.contrastText,
              "& svg": {
                color: theme.palette.primary.contrastText,
              },
            },
          },
          "& .MuiListItemText-root": {
            marginY: 0,
          },
          "& .MuiListItemIcon-root": {
            minWidth: 0,
            marginRight: 1,
          },
        }}
      >
        {/* <ListSubheader sx={{ fontSize: "1rem" }}>Dashboard</ListSubheader> */}
        <Link href="/" passHref>
          <ListItemButton component="a" selected={pathname === "/"}>
            <ListItemIcon sx={{ color: "inherit" }}>
              <Icons.Home />
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
        </Link>
        <ListSubheader
          sx={{
            fontSize: "1rem",
            textTransform: "uppercase",
            fontWeight: "500",
          }}
        >
          General
        </ListSubheader>
        {[
          {
            link: "/records",
            icon: <Icons.TableView />,
            label: "Recent Records",
          },
          {
            link: "/media",
            icon: <Icons.PermMedia />,
            label: "Media",
          },
        ].map((entry, i) => {
          return (
            <Link key={`records-${i}`} href={entry?.link || "/#"} passHref>
              <ListItemButton component="a" selected={pathname === entry?.link}>
                <ListItemIcon sx={{ color: "inherit" }}>
                  {entry?.icon}
                </ListItemIcon>
                <ListItemText primary={entry?.label} />
              </ListItemButton>
            </Link>
          );
        })}
        <ListSubheader
          sx={{
            fontSize: "1rem",
            textTransform: "uppercase",
            fontWeight: "500",
          }}
        >
          Integration Hub
        </ListSubheader>
        {[
          {
            link: "/settings/dashboard",
            icon: <Icons.Dashboard />,
            label: "Dashboard",
          },
          {
            link: "/settings/marketplace",
            icon: <Icons.Store />,
            label: "Marketplace",
          },
          {
            link: "/settings/integrations",
            icon: <Icons.AccountTree />,
            label: "Designer",
          },
        ].map((entry, i) => {
          return (
            <Link key={`integrations-${i}`} href={entry?.link || "/#"} passHref>
              <ListItemButton component="a" selected={pathname === entry?.link}>
                <ListItemIcon sx={{ color: "inherit" }}>
                  {entry?.icon}
                </ListItemIcon>
                <ListItemText primary={entry?.label} />
              </ListItemButton>
            </Link>
          );
        })}
        <ListSubheader
          sx={{
            fontSize: "1rem",
            textTransform: "uppercase",
            fontWeight: "500",
          }}
        >
          Settings
        </ListSubheader>
        {[
          {
            link: "/settings/user",
            icon: <Icons.Person />,
            label: "Users",
          },
          {
            link: "/settings/company",
            icon: <Icons.Business />,
            label: "Company",
          },
        ].map((entry, i) => {
          return (
            <Link key={`settings-${i}`} href={entry?.link || "/#"} passHref>
              <ListItemButton component="a" selected={pathname === entry?.link}>
                <ListItemIcon sx={{ color: "inherit" }}>
                  {entry?.icon}
                </ListItemIcon>
                <ListItemText primary={entry?.label} />
              </ListItemButton>
            </Link>
          );
        })}
      </List>
    </Drawer>
  );
};

export default AppDrawer;
