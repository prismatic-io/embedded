import { writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fetchWorkflowContexts } from "./fetchWorkflowContexts";
import { generateTypes } from "./generateTypes";

const main = async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: "string", short: "o", default: "prismatic.d.ts" },
    },
  });
  const output = values.output;
  const outputPath = path.resolve(process.cwd(), output);

  console.log("Fetching workflow contexts...");
  const contexts = await fetchWorkflowContexts();
  console.log(`Found ${contexts.length} workflow context(s).`);

  console.log("Generating types...");
  const content = await generateTypes(contexts);

  await writeFile(outputPath, content, "utf-8");
  console.log(`Types written to ${outputPath}`);
  console.log(
    `\nMake sure this file is included in your tsconfig.json:\n\n  {\n    "include": ["${output}"]\n  }`,
  );
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
