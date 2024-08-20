import { Container, MenuItem, Select } from "@mui/material";
import { parse } from "yaml";

import React from "react";

interface Step {
  name: string;
}

interface Flow {
  name: string;
  steps: Step[];
}

interface IntegrationDefinition {
  flows: Flow[];
}

function RenderSteps({ steps }) {
  console.log({ steps });
  return steps ? (
    <ul>
      {steps.map((step) => (
        <li key={step.name}>
          {step.name}
          <RenderSteps steps={step.steps} />
          {step.branches ? (
            <ul>
              {step.branches.map((branch) => (
                <li key={branch.name}>
                  {branch.name}
                  <RenderSteps steps={branch.steps} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null;
}

function FlowRenderer({ definition }) {
  const { flows } = parse(definition) as IntegrationDefinition;
  const [activeFlowName, setActiveFlowName] = React.useState(flows[0].name);
  const [steps, setSteps] = React.useState<Step[]>([]);

  React.useEffect(() => {
    setSteps(flows.find((f) => f.name === activeFlowName).steps);
  }, [activeFlowName]);

  return (
    <Container>
      <Select
        onChange={({ target }) => {
          setActiveFlowName(target.value);
        }}
        value={activeFlowName}
      >
        {flows.map((flow) => (
          <MenuItem value={flow.name} key={flow.name}>
            {flow.name}
          </MenuItem>
        ))}
      </Select>
      <div>
        <RenderSteps steps={steps} />
      </div>
    </Container>
  );
}

export default FlowRenderer;
