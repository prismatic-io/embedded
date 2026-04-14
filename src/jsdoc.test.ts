import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const indexPath = resolve(__dirname, "index.ts");

const createProgram = () => {
  const configPath = ts.findConfigFile(indexPath, ts.sys.fileExists);
  if (!configPath) throw new Error("tsconfig not found");
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(
    config,
    ts.sys,
    resolve(__dirname, ".."),
  );
  return ts.createProgram([indexPath], options);
};

const getDocumentation = (symbol: ts.Symbol, checker: ts.TypeChecker): string =>
  ts.displayPartsToString(symbol.getDocumentationComment(checker));

const resolveSymbol = (
  symbol: ts.Symbol,
  checker: ts.TypeChecker,
): ts.Symbol =>
  symbol.flags & ts.SymbolFlags.Alias
    ? checker.getAliasedSymbol(symbol)
    : symbol;

/**
 * Extract the JSDoc text for every named export and every property on the
 * default export, then return them keyed by name.
 */
const collectDocs = () => {
  const program = createProgram();
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(indexPath);
  if (!sourceFile) throw new Error(`Source file not found: ${indexPath}`);
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) throw new Error("Module symbol not found");
  const exports = checker.getExportsOfModule(moduleSymbol);

  const namedDocs = new Map<string, string>();
  const defaultDocs = new Map<string, string>();

  for (const exp of exports) {
    if (exp.getName() === "default") {
      const resolved = resolveSymbol(exp, checker);
      const declaration =
        resolved.valueDeclaration ?? resolved.declarations?.[0];
      if (!declaration) throw new Error("Default export has no declaration");
      const defaultType = checker.getTypeOfSymbolAtLocation(
        resolved,
        declaration,
      );

      for (const prop of defaultType.getProperties()) {
        const resolvedProp = resolveSymbol(prop, checker);
        defaultDocs.set(
          prop.getName(),
          getDocumentation(resolvedProp, checker),
        );
      }
    } else {
      const resolved = resolveSymbol(exp, checker);
      if (resolved.flags & ts.SymbolFlags.Value) {
        namedDocs.set(exp.getName(), getDocumentation(resolved, checker));
      }
    }
  }

  return { namedDocs, defaultDocs };
};

describe("default export JSDoc parity", () => {
  const { namedDocs, defaultDocs } = collectDocs();

  const namedKeys = new Set(namedDocs.keys());
  const defaultKeys = new Set(defaultDocs.keys());

  it("default export has the same keys as the named value exports", () => {
    const missingFromDefault = new Set(
      [...namedKeys].filter((k) => !defaultKeys.has(k)),
    );
    const extraOnDefault = new Set(
      [...defaultKeys].filter((k) => !namedKeys.has(k)),
    );

    expect(missingFromDefault).toEqual(new Set());
    expect(extraOnDefault).toEqual(new Set());
  });

  it.each([
    ...namedKeys,
  ])("%s has matching JSDoc on the default export", (name) => {
    expect(defaultDocs.get(name)).toBe(namedDocs.get(name));
  });
});
