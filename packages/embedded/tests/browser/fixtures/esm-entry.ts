import prismatic from "@prismatic-io/embedded";

const main = async (): Promise<void> => {
  prismatic.init({
    prismaticUrl: window.location.origin,
    skipPreload: true,
  });
  await prismatic.authenticate({ token: "fake-jwt" });
  prismatic.showMarketplace({ usePopover: true });
};

main().catch((err) => {
  console.error(err);
});
