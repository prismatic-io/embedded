import type { z } from "zod";
import type { ServerFunctionAction } from "./resource.js";

type Inputs = z.infer<z.ZodObject<{ baseId: z.ZodString }>>;
type Output = z.infer<z.ZodObject<{ tables: z.ZodArray<z.ZodString> }>>;

const hostContracts = (action: ServerFunctionAction<Inputs, Output>) => {
  action.execute({ inputs: { baseId: "base" } }).then((result) => {
    if (result.status === "success") {
      const tables: string[] = result.data.tables;
      void tables;
      // @ts-expect-error The output contract is not erased.
      const invalid: number = result.data.tables;
      void invalid;
    }
  });
  // @ts-expect-error Host-inferred input types remain checked.
  action.execute({ inputs: { baseId: 1 } });
};
void hostContracts;
