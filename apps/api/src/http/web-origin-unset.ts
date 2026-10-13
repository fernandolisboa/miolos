import { errorResponse } from "./responses";

export function webOriginUnset(): Response | undefined {
  return process.env.WEB_ORIGIN
    ? undefined
    : errorResponse(503, "web-origin-unconfigured");
}
