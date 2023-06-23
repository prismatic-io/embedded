import { Box, Container, Link, Typography, styled } from "@mui/material";

const FooterWrapper = styled(Container)(({ theme }) => ({
  marginTop: theme.spacing(4),
}));

function Footer() {
  return (
    <FooterWrapper className="footer-wrapper">
      <Box
        pb={4}
        display={{ xs: "block", md: "flex" }}
        alignItems="center"
        textAlign={{ xs: "center", md: "left" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="subtitle1">
            &copy; {new Date().getFullYear()} - Prismatic.io
          </Typography>
        </Box>
        <Typography sx={{ pt: { xs: 2, md: 0 } }} variant="subtitle1">
          <Link
            href="https://prismatic.io/docs/installing-embedded/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the Docs
          </Link>
        </Typography>
      </Box>
    </FooterWrapper>
  );
}

export default Footer;
