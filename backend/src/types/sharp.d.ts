/**
 * Ambient module declaration so `tsc` can compile when workspace hoisting
 * differs between hosts. Runtime still requires `sharp` — see `scripts/ensure-sharp.mjs`.
 */
declare module "sharp" {
  interface SharpMetadata {
    width?: number;
    height?: number;
  }

  interface SharpRegion {
    left: number;
    top: number;
    width: number;
    height: number;
  }

  interface CompositeInput {
    input: Buffer | string;
    blend?: string;
  }

  interface SharpInstance {
    metadata(): Promise<SharpMetadata>;
    resize(width: number, height: number, options?: { fit?: string }): SharpInstance;
    ensureAlpha(): SharpInstance;
    composite(inputs: CompositeInput[]): SharpInstance;
    extract(region: SharpRegion): SharpInstance;
    png(): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }

  interface SharpConstructor {
    (input?: Buffer | string): SharpInstance;
  }

  const sharp: SharpConstructor;
  export default sharp;
}
