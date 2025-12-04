/* eslint-disable @next/next/no-img-element */
import React, { useState } from "react";
import { alpha } from "@mui/material/styles";
import { useRouter } from "next/router";
import MuiAppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MailIcon from "@mui/icons-material/Mail";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Badge from "@mui/material/Badge";
import SearchIcon from "@mui/icons-material/Search";
import AccountCircle from "@mui/icons-material/AccountCircle";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { Menu, MenuItem, Avatar } from "@mui/material";
import { Person, ExitToApp } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

const AppBar: React.FC<{
  icon: string;
  name: string;
  toggleOpen: () => void;
}> = ({ icon, name, toggleOpen }) => {
  const router = useRouter();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);
  const closeMenu = () => {
    setAnchorEl(null);
  };

  return (
    <MuiAppBar
      sx={{
        flexDirection: "row",
        flexGrow: 2,
        width: "100%",
        position: "relative !important",
      }}
    >
      <Toolbar
        variant="regular"
        sx={{
          pl: `20px !important`,
          display: "flex",
          flexDirection: "row",
          flexGrow: 1,
          justifyContent: "space-between",
          width: "100%",
          backgroundColor: "#37474f",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignContent: "center",
            justifyContent: "flex-start",
          }}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignContent: "center",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <IconButton
              onClick={() => {
                toggleOpen();
              }}
            >
              <Avatar variant="rounded" src={icon}></Avatar>
            </IconButton>
            <Typography alignSelf="center" variant="h3" color="white" noWrap>
              {name}
            </Typography>
          </Box>
          <Box
            sx={{
              alignSelf: "center",
              borderRadius: theme.shape.borderRadius,
              backgroundColor: alpha(theme.palette.common.white, 0.15),
              "&:hover": {
                backgroundColor: alpha(theme.palette.common.white, 0.25),
              },
              marginRight: theme.spacing(1),
              width: "100%",
              maxHeight: "40px",
              [theme.breakpoints.up("sm")]: {
                marginLeft: theme.spacing(4),
                width: "auto",
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                height: "100%",
              }}
            >
              <IconButton
                sx={{
                  pl: 2,
                }}
              >
                <SearchIcon
                  sx={{
                    color: theme.palette.primary.contrastText,
                  }}
                />
              </IconButton>
              <InputBase
                placeholder="Search…"
                sx={{
                  color: theme.palette.primary.contrastText,
                  input: {
                    padding: theme.spacing(0.5, 0.5, 0.5, 0),
                    paddingLeft: `${theme.spacing(0.5)}`,
                    transition: theme.transitions.create("width"),
                    width: "100%",
                  },
                }}
                inputProps={{ "aria-label": "search" }}
              />
            </Box>
          </Box>
        </Box>
        <Box
          sx={{
            "& .MuiIconButton-root": {
              color: theme.palette.primary.contrastText,
            },
            paddingRight: "20px",
          }}
        >
          <IconButton aria-label="show 4 new mails">
            <Badge color="error" badgeContent={4}>
              <MailIcon />
            </Badge>
          </IconButton>
          <IconButton aria-label="show 17 new notifications">
            <Badge color="error" badgeContent={17}>
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton
            edge="end"
            aria-label="account of current user"
            aria-haspopup="true"
            onClick={(event) => {
              setAnchorEl(event.currentTarget);
            }}
          >
            <AccountCircle />
          </IconButton>
        </Box>
        <Menu
          id="menu-appbar"
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
          keepMounted
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          open={isMenuOpen}
          onClose={closeMenu}
        >
          <MenuItem
            onClick={() => {
              closeMenu();
              router.push("/settings/user");
            }}
          >
            <ListItemIcon>
              <Person fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Profile" data-cy="account-profile" />
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              closeMenu();
              router.push("/api/auth/logout");
            }}
          >
            <ListItemIcon>
              <ExitToApp fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Log Out" data-cy="logout" />
          </MenuItem>
        </Menu>
      </Toolbar>
    </MuiAppBar>
  );
};

export default AppBar;
