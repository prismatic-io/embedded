import { Container, type ContainerProps, styled } from "@mui/material";

const StyledFrame = styled(Container)(() => ({
  flex: 1,
  minHeight: 0,
  width: "100%",
}));

function EmbeddedFrame(props: ContainerProps) {
  return <StyledFrame maxWidth={false} disableGutters {...props} />;
}

export default EmbeddedFrame;
