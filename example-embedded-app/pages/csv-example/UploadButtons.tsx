import {
  Alert,
  Box,
  Button,
  Container,
  LinearProgress,
  TextField,
} from "@mui/material";
import Papa from "papaparse";
import React, { Dispatch, SetStateAction } from "react";
import { Instance } from "./getInstances";

interface UploadCsvParams {
  fileName: string;
  uploadUrl: string;
  data: unknown[];
  setUploadState: Dispatch<SetStateAction<UploadState>>;
}

function uploadCsv({
  fileName,
  uploadUrl,
  data,
  setUploadState,
}: UploadCsvParams) {
  setUploadState("uploading");
  const csvData = Papa.unparse(data.map(({ id, ...rest }) => rest));
  const formData = new FormData();
  formData.append("file", csvData);
  formData.append("fileName", fileName);
  fetch(uploadUrl, { method: "post", body: formData })
    .then(() => {
      setUploadState("success");
      setTimeout(() => setUploadState("idle"), 4000);
    })
    .catch(() => {
      setUploadState("failed");
    });
}

type UploadState = "idle" | "uploading" | "success" | "failed";

function ProgressIndicator({ state }: { state: UploadState }) {
  switch (state) {
    case "idle":
      return null;
    case "uploading":
      return (
        <Box>
          <LinearProgress />
        </Box>
      );
    case "success":
      return <Alert severity="success">Upload successful</Alert>;
    case "failed":
      return <Alert severity="error">Upload failed</Alert>;
  }
}

function UploadButtons({
  data,
  instances,
}: {
  data: any;
  instances: Instance[];
}) {
  const [fileName, setFileName] = React.useState("");
  const [uploadState, setUploadState] = React.useState<UploadState>("idle");

  return (
    <Container>
      <hr />
      <TextField
        onChange={({ target }) => {
          setFileName(target.value);
        }}
        label="File Name"
      />
      {instances.map((instance) => (
        <Button
          key={instance.integration.name}
          onClick={() => {
            uploadCsv({
              fileName,
              uploadUrl: instance.webhookUrls["upload"],
              data,
              setUploadState,
            });
          }}
        >
          Upload to {instance.integration.name}
        </Button>
      ))}
      <ProgressIndicator state={uploadState} />
    </Container>
  );
}

export default UploadButtons;
