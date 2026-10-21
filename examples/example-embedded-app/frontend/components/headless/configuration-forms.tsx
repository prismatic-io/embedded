import type {
  Configuration,
  ConfigurationConnectionSelection,
  ConfigurationResource,
} from "@prismatic-io/solis-react";
import type { ReactNode } from "react";
import {
  type FakeCrmConfiguration,
  FakeCrmConfigurationForm,
  type FormLayout,
} from "#/components/headless/fake-crm-configuration-form";
import {
  type SlackConfiguration,
  SlackConfigurationForm,
} from "#/components/headless/slack-configuration-form";

/** What every configuration form in this app takes. */
export interface ConfigurationFormProps {
  configuration: ConfigurationResource;
  /** The values the integration's `init` suggested. */
  initialValues: unknown;
  busy: boolean;
  submitLabel: string;
  /** Validation errors Prismatic returned from the last save, by JSON path. */
  fieldErrors: { path: string | null; message: string }[];
  /** The connections to run server functions with, by requirement key. */
  connections: readonly ConfigurationConnectionSelection[];
  layout: FormLayout;
  onSubmit: (value: unknown) => void;
  onCancel?: () => void;
}

/**
 * The forms this app has for headless integrations. A headless integration
 * defines its schema, but your app decides how to draw it, so each form here is
 * written for one integration.
 *
 * A form is matched to an integration by a server function only that
 * integration defines. Matching on something the integration declares, rather
 * than on its name, keeps a renamed integration working.
 */
const FORMS: {
  serverFunction: string;
  render: (props: ConfigurationFormProps) => ReactNode;
}[] = [
  {
    serverFunction: "listRecordTypes",
    render: (props) => (
      <FakeCrmConfigurationForm
        {...props}
        initialValues={props.initialValues as FakeCrmConfiguration}
      />
    ),
  },
  {
    serverFunction: "listChannels",
    render: (props) => (
      <SlackConfigurationForm
        {...props}
        initialValues={props.initialValues as SlackConfiguration}
      />
    ),
  },
];

/** This app's form for a configuration, or `null` when it has none. */
export function findConfigurationForm(
  configuration: Configuration,
): ((props: ConfigurationFormProps) => ReactNode) | null {
  const form = FORMS.find(({ serverFunction }) =>
    configuration.serverFunctions.some(({ key }) => key === serverFunction),
  );
  return form?.render ?? null;
}
