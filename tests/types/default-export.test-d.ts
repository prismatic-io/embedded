import { expectTypeOf } from "expect-type";
import defaultExport from "../../src";
import * as methods from "../../src/lib";

expectTypeOf(defaultExport).toEqualTypeOf<typeof methods>();
