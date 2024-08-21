import { CableTwoTone } from "@mui/icons-material";
import { Avatar } from "@mui/material";
import config from "prismatic/config";
import React from "react";

function PrismaticAvatar({ avatarUrl, token }) {
  const [src, setSrc] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    if (avatarUrl) {
      fetch(`${config.prismaticUrl}${avatarUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((response) => {
        response.json().then((data) => {
          if (mounted) {
            setSrc(data.url);
          }
        });
      });
    }

    return () => {
      mounted = false;
    };
  }, []);

  if (!avatarUrl) {
    return (
      <Avatar>
        <CableTwoTone />
      </Avatar>
    );
  }

  return src ? <Avatar variant="rounded" src={src} /> : null;
}

export default PrismaticAvatar;
