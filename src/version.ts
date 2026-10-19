declare const __AUTOSKELETON_VERSION__: string | undefined;

/** The installed autoskeleton version, e.g. "0.1.0" or "0.2.0-nightly.57". */
export const version: string = typeof __AUTOSKELETON_VERSION__ === "string" ? __AUTOSKELETON_VERSION__ : "dev";
