import {
  AutoAwesomeTwoTone,
  CableTwoTone,
  ConstructionTwoTone,
  DashboardTwoTone,
  PictureInPictureTwoTone,
  RocketLaunchTwoTone,
  TerminalTwoTone,
  TranslateTwoTone,
  ViewComfyAltTwoTone,
  WebTwoTone,
} from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  List,
  ListItem,
  ListSubheader,
  type SvgIcon,
  styled,
} from "@mui/material";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useContext } from "react";
import { SidebarContext } from "src/contexts/SidebarContext";

const MenuWrapper = styled(Box)(({ theme }) => ({
  ".MuiList-root": {
    padding: theme.spacing(1),

    "& > .MuiList-root": {
      padding: `0 ${theme.spacing(0)} ${theme.spacing(1)}`,
    },
  },
  ".MuiListSubheader-root": {
    textTransform: "uppercase",
    fontWeight: "bold",
    fontSize: theme.typography.pxToRem(12),
    color: theme.colors.alpha.trueWhite[50],
    padding: theme.spacing(0, 2.5),
    lineHeight: 1.4,
  },
}));

const SubMenuWrapper = styled(Box)(({ theme }) => ({
  ".MuiList-root": {
    ".MuiListItem-root": {
      padding: "1px 0",
      ".MuiBadge-root": {
        position: "absolute",
        right: theme.spacing(3.2),

        ".MuiBadge-standard": {
          background: theme.colors.primary.main,
          fontSize: theme.typography.pxToRem(10),
          fontWeight: "bold",
          textTransform: "uppercase",
          color: theme.palette.primary.contrastText,
        },
      },
      ".MuiButton-root": {
        display: "flex",
        color: theme.colors.alpha.trueWhite[70],
        backgroundColor: "transparent",
        width: "100%",
        justifyContent: "flex-start",
        padding: theme.spacing(1.2, 3),
        ".MuiButton-startIcon, .MuiButton-endIcon": {
          transition: theme.transitions.create(["color"]),

          ".MuiSvgIcon-root": {
            fontSize: "inherit",
            transition: "none",
          },
        },
        ".MuiButton-startIcon": {
          color: theme.colors.alpha.trueWhite[30],
          fontSize: theme.typography.pxToRem(20),
          marginRight: theme.spacing(1),
        },
        ".MuiButton-endIcon": {
          color: theme.colors.alpha.trueWhite[50],
          marginLeft: "auto",
          opacity: ".8",
          fontSize: theme.typography.pxToRem(20),
        },
        "&.active,&:hover": {
          backgroundColor: alpha(theme.colors.alpha.trueWhite[100], 0.06),
          color: theme.colors.alpha.trueWhite[100],
          ".MuiButton-startIcon,.MuiButton-endIcon": {
            color: theme.colors.alpha.trueWhite[100],
          },
        },
      },
      "&.Mui-children": {
        flexDirection: "column",
        ".MuiBadge-root": {
          position: "absolute",
          right: theme.spacing(7),
        },
      },
      ".MuiCollapse-root": {
        width: "100%",
        ".MuiList-root": {
          padding: theme.spacing(1, 0),
        },
        ".MuiListItem-root": {
          padding: "1px 0",
          ".MuiButton-root": {
            padding: theme.spacing(0.8, 3),
            ".MuiBadge-root": {
              right: theme.spacing(3.2),
            },
            "&:before": {
              content: '" "',
              background: theme.colors.alpha.trueWhite[100],
              opacity: 0,
              transition: theme.transitions.create(["transform", "opacity"]),
              width: "6px",
              height: "6px",
              transform: "scale(0)",
              transformOrigin: "center",
              borderRadius: "20px",
              marginRight: theme.spacing(1.8),
            },

            "&.active, &:hover": {
              "&:before": {
                transform: "scale(1)",
                opacity: 1,
              },
            },
          },
        },
      },
    },
  },
}));

interface EmbeddedSidebarMenuProps {
  path: string;
  title: string;
  icon: typeof SvgIcon;
}

interface EmbeddedSidebarSection {
  heading: string;
  items: EmbeddedSidebarMenuProps[];
}

const embeddedSidebarSections: EmbeddedSidebarSection[] = [
  {
    heading: "Workflow Builder",
    items: [
      {
        path: "/examples/embedded-workflow-builder",
        title: "Workflow Builder",
        icon: ConstructionTwoTone,
      },
      {
        path: "/examples/embedded-workflow-builder-copilot",
        title: "Workflow Builder + Copilot",
        icon: AutoAwesomeTwoTone,
      },
    ],
  },
  {
    heading: "Marketplace",
    items: [
      {
        path: "/examples/embedded-marketplace",
        title: "Marketplace",
        icon: WebTwoTone,
      },
      {
        path: "/examples/embedded-marketplace-popover",
        title: "Marketplace Popover",
        icon: PictureInPictureTwoTone,
      },
      {
        path: "/examples/dynamically-set-config-variables",
        title: "Set Config Variables",
        icon: TerminalTwoTone,
      },
    ],
  },
  {
    heading: "Manage",
    items: [
      {
        path: "/examples/embedded-dashboard",
        title: "Customer Dashboard",
        icon: DashboardTwoTone,
      },
      {
        path: "/examples/embedded-connections",
        title: "Connections",
        icon: CableTwoTone,
      },
      {
        path: "/examples/edit-instance-configuration",
        title: "Edit Instance Configuration",
        icon: ConstructionTwoTone,
      },
    ],
  },
  {
    heading: "Customize",
    items: [
      {
        path: "/examples/custom-ui-elements",
        title: "Custom UI Elements",
        icon: ViewComfyAltTwoTone,
      },
      {
        path: "/examples/i18n",
        title: "Internationalization (i18n)",
        icon: TranslateTwoTone,
      },
    ],
  },
];

function SidebarMenu() {
  const { closeSidebar } = useContext(SidebarContext);
  const router = useRouter();
  const currentRoute = router.pathname;

  return (
    <MenuWrapper>
      <List
        component="div"
        subheader={
          <ListSubheader component="div" disableSticky>
            Dashboards
          </ListSubheader>
        }
      >
        <SubMenuWrapper>
          <List component="div">
            <ListItem component="div">
              <Button
                className={currentRoute === "/" ? "active" : ""}
                disableRipple
                component={NextLink}
                href="/"
                onClick={closeSidebar}
                startIcon={<RocketLaunchTwoTone />}
              >
                Rocket Launches
              </Button>
            </ListItem>
          </List>
        </SubMenuWrapper>
      </List>
      {embeddedSidebarSections.map((section) => (
        <List
          key={section.heading}
          component="div"
          subheader={
            <ListSubheader component="div" disableSticky>
              {section.heading}
            </ListSubheader>
          }
        >
          <SubMenuWrapper>
            <List component="div">
              {section.items.map((item) => (
                <ListItem key={item.path} component="div">
                  <Button
                    className={currentRoute === item.path ? "active" : ""}
                    disableRipple
                    component={NextLink}
                    href={item.path}
                    onClick={closeSidebar}
                    startIcon={<item.icon />}
                  >
                    {item.title}
                  </Button>
                </ListItem>
              ))}
            </List>
          </SubMenuWrapper>
        </List>
      ))}
    </MenuWrapper>
  );
}

export default SidebarMenu;
