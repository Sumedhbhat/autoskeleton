// Emit dist/styles.css from the same source the runtime injects.
import { writeFileSync } from "node:fs";
const { autoskeletonCss } = await import("../dist/index.js");
writeFileSync(new URL("../dist/styles.css", import.meta.url), autoskeletonCss + "\n");
