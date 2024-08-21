import Head from "next/head";

import Footer from "@/components/Footer";
import SidebarLayout from "@/layouts/SidebarLayout";
import usePrismaticAuth from "@/usePrismaticAuth";
import {
  Button,
  CardHeader,
  Container,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import Papa from "papaparse";
import React from "react";
import getInstances, { Instance } from "./getInstances";
import PrismaticAvatar from "./PrismaticAvatar";
import CsvDataTable from "./CsvDataTable";
import { useTable } from "ka-table";
import UploadButtons from "./UploadButtons";
import PageTitleWrapper from "@/components/PageTitleWrapper";

import csvExampleHelperText from "./csv-example.md";
import ExampleHeader from "@/components/ExampleHeader";

function CsvExample() {
  const { authenticated, token } = usePrismaticAuth();
  const [instances, setInstances] = React.useState<Instance[]>();
  const [csvFiles, dispatchCsvFiles] = React.useReducer((state, files) => {
    return [...state, ...files];
  }, []);
  const [csvData, setCsvData] = React.useState([]);
  const [showingTable, setShowingTable] = React.useState(false);
  const csvDataTable = useTable({
    onDispatch: (_, tableState) => setCsvData(tableState.data),
  });

  // Get enabled relevant instances
  React.useEffect(() => {
    if (authenticated) {
      getInstances().then((r) => setInstances(r));
    }
  }, [authenticated]);

  // Display CSV files from each integration:
  React.useEffect(() => {
    instances?.forEach((instance) => {
      fetch(instance.webhookUrls["list"]).then((response) => {
        response.json().then((data) => {
          dispatchCsvFiles(
            data
              .filter(
                (filename) =>
                  !csvFiles.find(
                    (csvFile) =>
                      csvFile.filename === filename &&
                      csvFile.integrationName === instance.integration.name,
                  ),
              )
              .map((filename) => ({
                filename,
                downloadFlowUrl: instance.webhookUrls["download"],
                avatarUrl: instance.integration.avatarUrl,
                integrationName: instance.integration.name,
              })),
          );
        });
      });
    });
  }, [instances]);

  const loadFile = (filename, downloadUrl) => {
    fetch(downloadUrl, {
      method: "post",
      body: JSON.stringify({ filename }),
      headers: { "content-type": "application/json" },
    }).then((response) => {
      response
        .text()
        .then((csvText) =>
          setCsvData(
            Papa.parse(csvText.replace(/\n$/, ""), { header: true }).data,
          ),
        );
      setShowingTable(true);
    });
  };

  return (
    <>
      <Head>
        <title>CSV Editor Example</title>
      </Head>
      <PageTitleWrapper>
        <ExampleHeader markdown={csvExampleHelperText} />
      </PageTitleWrapper>

      <Container>
        {csvFiles.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell></TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>File</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {csvFiles.map((csvFile) => (
                  <TableRow
                    key={`${csvFile.filename}-${csvFile.integrationName}`}
                  >
                    <TableCell>
                      <Button
                        onClick={() => {
                          loadFile(csvFile.filename, csvFile.downloadFlowUrl);
                        }}
                      >
                        Load
                      </Button>
                    </TableCell>
                    <TableCell>
                      <CardHeader
                        avatar={
                          <PrismaticAvatar
                            avatarUrl={csvFile.avatarUrl}
                            token={token}
                          />
                        }
                        title={csvFile.integrationName}
                      />
                    </TableCell>
                    <TableCell>{csvFile.filename}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <LinearProgress />
        )}
        <hr />
        {showingTable ? (
          <React.Fragment>
            <CsvDataTable data={csvData} table={csvDataTable} />
            <UploadButtons data={csvData} instances={instances} />
          </React.Fragment>
        ) : null}
      </Container>
      <Footer />
    </>
  );
}

CsvExample.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default CsvExample;
