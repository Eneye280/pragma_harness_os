import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { deflateSync } from "zlib";
import { decodePng } from "../png";
import { comparePngScreenshots, evaluateVisual } from "../visual-gate";

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makePng(width: number, height: number, pixel: (x: number, y: number) => [number, number, number, number]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows: number[] = [];
  for (let y = 0; y < height; y++) {
    rows.push(0);
    for (let x = 0; x < width; x++) rows.push(...pixel(x, y));
  }
  const idat = deflateSync(Buffer.from(rows));
  const iend = Buffer.alloc(0);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", iend)]);
}

const solid = (color: [number, number, number, number]) => makePng(4, 4, () => color);

describe("visual gate", () => {
  let workspacePath = "";

  beforeEach(() => {
    workspacePath = join(tmpdir(), `phs58-${randomUUID().slice(0, 8)}`);
    mkdirSync(workspacePath, { recursive: true });
  });

  afterEach(() => {
    if (workspacePath && existsSync(workspacePath)) rmSync(workspacePath, { recursive: true, force: true });
  });

  it("decodes a PNG into RGBA", () => {
    const decoded = decodePng(makePng(2, 1, (x) => (x === 0 ? [255, 0, 0, 255] : [0, 255, 0, 255])));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(1);
    expect([...decoded.rgba.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...decoded.rgba.slice(4, 8)]).toEqual([0, 255, 0, 255]);
  });

  it("passes identical captures and flags changed ones", () => {
    const black = solid([0, 0, 0, 255]);
    const white = solid([255, 255, 255, 255]);
    expect(comparePngScreenshots(black, black).changed).toBe(false);
    const changed = comparePngScreenshots(black, white, 0.01);
    expect(changed.changed).toBe(true);
    expect(changed.changedRatio).toBe(1);
  });

  it("blocks on dimension mismatch", () => {
    const small = solid([10, 10, 10, 255]);
    const large = makePng(8, 8, () => [10, 10, 10, 255]);
    const diff = comparePngScreenshots(small, large);
    expect(diff.dimensionMismatch).toBe(true);
    expect(diff.changed).toBe(true);
  });

  it("creates a baseline on first capture and compares afterwards", () => {
    const first = evaluateVisual(workspacePath, "hud", solid([0, 0, 0, 255]));
    expect(first.baselineMissing).toBe(true);
    expect(first.changed).toBe(false);

    const unchanged = evaluateVisual(workspacePath, "hud", solid([0, 0, 0, 255]));
    expect(unchanged.changed).toBe(false);

    const changed = evaluateVisual(workspacePath, "hud", solid([240, 240, 240, 255]));
    expect(changed.changed).toBe(true);
    expect(changed.reason).toMatch(/supera el umbral/);
  });
});
