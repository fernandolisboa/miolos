import { isPlayedRecord, type PlayRecord } from "../play/play-record";

export type ArchiveCardStatus = "pending" | "completed" | "played";

export function archiveCardStatus(
  record: PlayRecord | undefined,
): ArchiveCardStatus {
  if (record === undefined || !record.concluded) {
    return "pending";
  }

  return isPlayedRecord(record) ? "played" : "completed";
}
