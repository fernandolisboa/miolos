import { dailyMinesweeperResponseSchema } from "@miolos/core";

import { dailyRoute } from "../../../src/daily-route";

export const dynamic = "force-dynamic";

export const GET = dailyRoute("minesweeper", dailyMinesweeperResponseSchema);
