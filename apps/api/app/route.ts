// Root response so the app answers at / without any page or layout.
export function GET(): Response {
  return Response.json({ service: "api" });
}
