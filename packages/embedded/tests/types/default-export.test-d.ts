import { expectTypeOf } from "expect-type";
import defaultExport from "../../src";
import * as allExports from "../../src/exports";

expectTypeOf(defaultExport).toEqualTypeOf<typeof allExports>();
