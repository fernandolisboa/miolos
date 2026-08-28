import os from "node:os";

export const maxWorkers = Math.max(1, Math.min(4, os.cpus().length - 1));
