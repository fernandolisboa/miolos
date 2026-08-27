export function isPushConfigured(): boolean {
  return (
    Boolean(process.env.VAPID_PUBLIC_KEY) &&
    Boolean(process.env.VAPID_PRIVATE_KEY) &&
    Boolean(process.env.VAPID_SUBJECT)
  );
}
