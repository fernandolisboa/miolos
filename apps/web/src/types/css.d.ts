import "csstype";

// csstype's endorsed extension point: register the custom properties the
// app sets inline, so style={{ "--accent": ... }} stays fully typed.
// The type parameters must match csstype's own declaration for the
// interfaces to merge.
declare module "csstype" {
  // The type parameter list must textually match csstype's own Properties
  // declaration for TypeScript interface merging to apply.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above
  interface Properties<TLength, TTime> {
    "--accent"?: string;
  }
}
