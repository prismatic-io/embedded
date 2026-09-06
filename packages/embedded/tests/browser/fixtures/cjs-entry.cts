const prismatic = require("@prismatic-io/embedded").default;

const main = async (): Promise<void> => {
  prismatic.init({
    prismaticUrl: window.location.origin,
    skipPreload: true,
  });
  await prismatic.authenticate({ token: "fake-jwt" });
  prismatic.showMarketplace({ usePopover: true });
};

main().catch((err: unknown) => {
  console.error(err);
});
