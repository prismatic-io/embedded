import { BookOpen } from "lucide-react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const helperText = import.meta.glob("./*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

function LinkNewWindow(
  props: React.ClassAttributes<HTMLAnchorElement> &
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
) {
  return (
    <a href={props.href} target="_blank" rel="noopener noreferrer">
      {props.children}
    </a>
  );
}

/** Where this app lives on GitHub. Source paths in the helper text link here. */
const SOURCE_URL =
  "https://github.com/prismatic-io/embedded/blob/main/examples/example-embedded-app";

/** A path to a file in this app, such as `frontend/lib/phrases.ts`. */
const SOURCE_PATH = /^(frontend|server|integrations)\/[\w./-]+$/;

/**
 * Inline code that names a file in this app links to that file on GitHub.
 * Any other code renders as usual.
 */
function CodeOrSourceLink({
  node: _node,
  children,
  ...rest
}: React.ComponentProps<"code"> & ExtraProps) {
  if (typeof children === "string" && SOURCE_PATH.test(children)) {
    return (
      <a
        href={`${SOURCE_URL}/${children}`}
        target="_blank"
        rel="noopener noreferrer"
        title="View this file on GitHub"
      >
        <code>{children}</code>
      </a>
    );
  }
  return <code {...rest}>{children}</code>;
}

type MarkdownFileId =
  | "basic-example-marketplace"
  | "basic-marketplace-popover"
  | "chat-bot"
  | "connections"
  | "custom-marketplace-ui"
  | "dashboard"
  | "edit-instance-configuration"
  | "headless-configuration"
  | "screen-configuration"
  | "translations"
  | "workflow-builder"
  | "workflow-contexts";

export function HelperText({ id }: { id: MarkdownFileId }) {
  const markdown = helperText[`./${id}.md`] as string;
  if (!markdown) {
    throw new Error(`Markdown file for id "${id}" not found.`);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen data-icon="inline-start" />
          Read about this example
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[70vh] w-[50vw] overflow-y-auto p-4 border"
      >
        <article className="prose prose-sm dark:prose-invert max-w-full">
          <ReactMarkdown
            components={{
              h1: "h2",
              a: LinkNewWindow,
              code: CodeOrSourceLink,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </PopoverContent>
    </Popover>
  );
}
