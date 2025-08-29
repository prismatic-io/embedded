import Head from "next/head";

import prismatic from "@prismatic-io/embedded";

import React from "react";
import SidebarLayout from "@/layouts/SidebarLayout";
import { Container, styled } from "@mui/material";
import usePrismaticAuth from "@/usePrismaticAuth";
import { useParams } from "next/navigation";

const WorkflowWrapper = styled(Container)(() => ({
	height: "calc(100vh - 90px)",
	width: "100%",
}));

const embeddedDivId = "embedded-workflow-div";

function Workflow() {
	const { authenticated } = usePrismaticAuth();
	const params = useParams();
	const { workflowId } = params ?? {};

	React.useEffect(() => {
		if (authenticated && typeof workflowId === "string" && workflowId) {
			prismatic.showWorkflow({
				selector: `#${embeddedDivId}`,
				theme: "LIGHT",
				workflowId,
			});
		}
	}, [authenticated, workflowId]);

	return (
		<>
			<Head>
				<title>Embedded Workflow</title>
			</Head>
			<WorkflowWrapper id={embeddedDivId} maxWidth={false} disableGutters />
		</>
	);
}

Workflow.getLayout = (page) => <SidebarLayout>{page}</SidebarLayout>;

export default Workflow;
