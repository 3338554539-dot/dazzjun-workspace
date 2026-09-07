const encoder = new TextEncoder();

const write16 = (view, offset, value) => view.setUint16(offset, value, true);
const write32 = (view, offset, value) => view.setUint32(offset, value, true);
const concat = (chunks) => {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
};

export const pngBytes = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
export const jpegBytes = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
export const webpBytes = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
export const pdfBytes = () => encoder.encode("%PDF-1.7\n%%EOF");

export function storedZip(entryNames = ["file.txt"]) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const entryName of entryNames) {
    const name = encoder.encode(entryName);
    const content = encoder.encode("fixture");
    const local = new Uint8Array(30 + name.length + content.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50);
    write16(localView, 4, 20);
    write32(localView, 18, content.length);
    write32(localView, 22, content.length);
    write16(localView, 26, name.length);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    locals.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write32(centralView, 20, content.length);
    write32(centralView, 24, content.length);
    write16(centralView, 28, name.length);
    write32(centralView, 42, localOffset);
    central.set(name, 46);
    centrals.push(central);
    localOffset += local.length;
  }

  const localData = concat(locals);
  const centralData = concat(centrals);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  write32(eocdView, 0, 0x06054b50);
  write16(eocdView, 8, entryNames.length);
  write16(eocdView, 10, entryNames.length);
  write32(eocdView, 12, centralData.length);
  write32(eocdView, 16, localData.length);
  return concat([localData, centralData, eocd]);
}
