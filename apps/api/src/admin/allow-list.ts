export function isAdmin(userId: string): boolean {
  const listed = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => id !== "");
  return listed.includes(userId.toLowerCase());
}
