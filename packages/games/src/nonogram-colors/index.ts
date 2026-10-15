import { MOTIFS } from "../nonogram/motifs";
import { MOTIF_TONE_RUNS } from "./tones.generated";

let runsById: ReadonlyMap<string, string> | undefined;

export function motifTones(
  motifId: string,
  mirrored: boolean,
): string | undefined {
  runsById ??= new Map(
    MOTIF_TONE_RUNS.split("\n").map((line) => {
      const [id = "", runs = ""] = line.split(":");
      return [id, runs];
    }),
  );
  const motif = MOTIFS.find((candidate) => candidate.id === motifId);
  const runs = runsById.get(motifId);
  if (motif === undefined || runs === undefined) {
    return undefined;
  }
  const tones = [...runs.matchAll(/([a-z])(\d*)/g)].flatMap(([, tone, count]) =>
    Array<string>(count ? Number(count) : 1).fill(tone ?? ""),
  );
  let next = 0;
  const rows = motif.rows.map((row) => {
    const painted = [...row].map((cell) =>
      cell === "#" ? tones[next++] : ".",
    );
    return (mirrored ? painted.reverse() : painted).join("");
  });
  return next === tones.length ? rows.join("") : undefined;
}

export { PICTURE_TONES } from "../nonogram/tones";
