import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchWorkflowContexts } from "./fetchWorkflowContexts";
import { generateTypes } from "./generateTypes";

const parseArgs = (args: string[]): { output: string } => {
  let output = "prismatic.d.ts";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      output = args[++i];
    }
  }

  return { output };
};

const main = async () => {
  const { output } = parseArgs(process.argv.slice(2));
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
