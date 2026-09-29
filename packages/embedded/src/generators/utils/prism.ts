import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execCb);

const isPrismAvailable = async (): Promise<boolean> => {
  try {
    await exec("prism --version", { windowsHide: true });
    return true;
  } catch {
    return false;
  }
};

export const getPrismAccessToken = async (): Promise<string> => {
  if (!(await isPrismAvailable())) {
    throw new Error(
      "Prism CLI must be installed. Please install it globally and run 'prism login' to authenticate.",
    );
  }

  try {
    const { stdout } = await exec("prism me:token", { windowsHide: true });
    const accessToken = stdout.replace(/\n$/, "").trim();

    if (!accessToken) {
      throw new Error(
        "Failed to get access token. Please run 'prism login' to authenticate.",
      );
    }

    return accessToken;
  } catch (error) {
    if (error instanceof Error && error.message.includes("command not found")) {
      throw new Error("Prism CLI not found. Please install it globally.");
    }
    throw new Error(
      `Failed to get access token: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

export const getPrismaticUrl = (): string =>
  process.env.PRISMATIC_URL ?? "https://app.prismatic.io";
