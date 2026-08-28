import "csstype";

declare module "csstype" {
  // The type parameter list must textually match csstype's own Properties
  // declaration for TypeScript interface merging to apply.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above
  interface Properties<TLength, TTime> {
    "--accent"?: string;
    "--ink-on-accent"?: string;
  }
}
