// Moved to lib so non-library modules (e.g. the dashboard) can reuse it without
// crossing the module boundary. Kept here as a re-export for existing imports.
export * from "@/lib/testHealth";
