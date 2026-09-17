import { BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
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

type MarkdownFileId =
  | "basic-example-marketplace"
  | "basic-marketplace-popover"
  | "chat-bot"
  | "connections"
  | "custom-marketplace-ui"
  | "dashboard"
  | "edit-instance-configuration"
  | "screen-configuration"
  | "translations";

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
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>
      </PopoverContent>
    </Popover>
  );
}
