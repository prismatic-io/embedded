/* eslint-disable @next/next/no-img-element */
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import Box from "@mui/material/Box";

import AppBar from "./AppBar";
import AppDrawer from "./AppDrawer";

const AppContainer: React.FC = ({ children }) => {
  const router = useRouter();
  const [designerRoute, setDesignerRoute] = React.useState(false);
  const [open, setOpen] = React.useState(true);

  useEffect(() => {
    setDesignerRoute(router.pathname.includes("/integrations"));
    if (router.pathname.includes("/integrations")) {
      setOpen(false);
    }
  }, [router.pathname]);

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
        }}
      >
        <AppBar
          icon={"/static/images/docs-screenshots/generic-icon.png"}
          name={"Acme SaaS"}
          toggleOpen={() => {
            setOpen(!open);
          }}
        ></AppBar>
        <Box
          id="content-wrapper"
          sx={{
            display: "flex",
            flexDirection: "row",
            flexGrow: 2,
            width: "100%",
            height: "100%",
            maxHeight: "100%",
          }}
        >
          <AppDrawer
            open={open}
            toggleOpen={() => setOpen(!open)}
            variant={designerRoute ? "temporary" : "persistent"}
          ></AppDrawer>
          <Box
            id="main-content"
            component="main"
            height={"100%"}
            width={"100%"}
            maxHeight={"100%"}
            overflow={"auto"}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default AppContainer;
