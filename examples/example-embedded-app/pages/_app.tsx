import prismatic from "@prismatic-io/embedded";
import type { NextPage } from "next";
import type { AppProps } from "next/app";
import Head from "next/head";
import Router from "next/router";
import nProgress from "nprogress";
import { type ReactElement, type ReactNode, useEffect } from "react";
import config from "../prismatic/config";
import "nprogress/nprogress.css";
import { CacheProvider, type EmotionCache } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import { SidebarProvider } from "src/contexts/SidebarContext";
import createEmotionCache from "src/createEmotionCache";
import ThemeProvider from "src/theme/ThemeProvider";

const clientSideEmotionCache = createEmotionCache();

type NextPageWithLayout = NextPage & {
  getLayout?: (page: ReactElement) => ReactNode;
};

/** Initialize Prismatic */
if (typeof window !== "undefined") {
  prismatic.init({
    prismaticUrl: config.prismaticUrl,
    fontConfiguration: {
      google: {
        families: ["Inter"],
      },
    },
  });
}

interface ExampleAppProps extends AppProps {
  emotionCache?: EmotionCache;
  Component: NextPageWithLayout;
}

function ExampleApp(props: ExampleAppProps) {
  const { Component, emotionCache = clientSideEmotionCache, pageProps } = props;
  const getLayout = Component.getLayout ?? ((page) => page);

  useEffect(() => {
    const handleStart = nProgress.start;
    const handleDone = nProgress.done;

    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeError", handleDone);
    Router.events.on("routeChangeComplete", handleDone);

    () => {
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeError", handleDone);
      Router.events.off("routeChangeComplete", handleDone);
    };
  }, []);

  return (
    <CacheProvider value={emotionCache}>
      <Head>
        <title>Example Admin Dashboard</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
      </Head>
      <SidebarProvider>
        <ThemeProvider>
          <CssBaseline />
          {getLayout(<Component {...pageProps} />)}
        </ThemeProvider>
      </SidebarProvider>
    </CacheProvider>
  );
}

export default ExampleApp;
