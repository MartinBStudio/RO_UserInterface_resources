import { PNG } from 'pngjs';

const rgb565 = value => [Math.round((value >> 11) * 255 / 31), Math.round(((value >> 5) & 63) * 255 / 63), Math.round((value & 31) * 255 / 31), 255];

// Decode the first mip level. UI sheets use BC1/2/3 or uncompressed RGB(A).
export function decodeDDS(buffer) {
  if (buffer.length < 128 || buffer.toString('ascii', 0, 4) !== 'DDS ') throw Error('Invalid DDS header');
  const height = buffer.readUInt32LE(12), width = buffer.readUInt32LE(16);
  if (!width || !height || width * height > 64 * 1024 * 1024) throw Error('Invalid DDS dimensions');
  let format = buffer.toString('ascii', 84, 88), offset = 128;
  if (format === 'DX10') {
    const dxgi = buffer.readUInt32LE(128);
    format = ({71:'DXT1', 72:'DXT1', 74:'DXT3', 75:'DXT3', 77:'DXT5', 78:'DXT5', 28:'RGBA', 87:'BGRA'})[dxgi];
    if (!format) throw Error(`DDS DXGI format ${dxgi} is not supported`);
    offset += 20;
  }
  const data = Buffer.alloc(width * height * 4);
  if (['DXT1','DXT3','DXT5'].includes(format)) {
    const blockSize = format === 'DXT1' ? 8 : 16;
    for (let by = 0; by < height; by += 4) for (let bx = 0; bx < width; bx += 4, offset += blockSize) {
      if (offset + blockSize > buffer.length) throw Error('Truncated DDS blocks');
      const colorOffset = offset + (blockSize === 16 ? 8 : 0);
      const c0 = buffer.readUInt16LE(colorOffset), c1 = buffer.readUInt16LE(colorOffset + 2);
      const colors = [rgb565(c0), rgb565(c1)];
      if (c0 > c1 || format !== 'DXT1') {
        colors.push(colors[0].map((v, i) => i === 3 ? 255 : Math.floor((2*v + colors[1][i])/3)));
        colors.push(colors[0].map((v, i) => i === 3 ? 255 : Math.floor((v + 2*colors[1][i])/3)));
      } else {
        colors.push(colors[0].map((v, i) => i === 3 ? 255 : Math.floor((v + colors[1][i])/2)), [0,0,0,0]);
      }
      const indices = buffer.readUInt32LE(colorOffset + 4);
      let alphaTable, alphaBits;
      if (format === 'DXT5') {
        const a0 = buffer[offset], a1 = buffer[offset + 1]; alphaTable = [a0, a1];
        const steps = a0 > a1 ? 7 : 5;
        for (let i = 1; i < steps; i++) alphaTable.push(Math.floor(((steps-i)*a0 + i*a1)/steps));
        if (steps === 5) alphaTable.push(0,255);
        alphaBits = buffer.readUIntLE(offset + 2, 6);
      }
      for (let p = 0; p < 16; p++) {
        const x = bx + p%4, y = by + Math.floor(p/4);
        if (x >= width || y >= height) continue;
        const color = colors[(indices >>> (p*2)) & 3];
        const dest = (y*width + x)*4;
        data[dest] = color[0]; data[dest+1] = color[1]; data[dest+2] = color[2];
        data[dest+3] = format === 'DXT3' ? ((buffer[offset + (p>>1)] >> ((p%2)*4)) & 15)*17
          : format === 'DXT5' ? alphaTable[Math.floor(alphaBits / 2**(p*3)) % 8] : color[3];
      }
    }
  } else {
    const bits = ['RGBA','BGRA'].includes(format) ? 32 : buffer.readUInt32LE(88);
    const masks = format === 'RGBA' ? [255,65280,16711680,4278190080] : format === 'BGRA' ? [16711680,65280,255,4278190080]
      : [92,96,100,104].map(i => buffer.readUInt32LE(i));
    if (![16,24,32].includes(bits) || !masks[0]) throw Error(`Unsupported DDS format ${JSON.stringify(format)} (${bits} bit)`);
    const bytes = bits/8, pitch = Math.max(width*bytes, buffer.readUInt32LE(20) || 0);
    const channel = (v, mask, fallback) => {
      if (!mask) return fallback;
      let shift = 0; while (((mask >>> shift) & 1) === 0) shift++;
      return Math.round(((v & mask) >>> shift) * 255 / (mask >>> shift));
    };
    if (offset + pitch*(height-1) + width*bytes > buffer.length) throw Error('Truncated DDS pixels');
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const v = buffer.readUIntLE(offset+y*pitch+x*bytes, bytes), dest = (y*width+x)*4;
      masks.forEach((mask, c) => { data[dest+c] = channel(v, mask, c === 3 ? 255 : 0); });
    }
  }
  return { width, height, data };
}

export function decodeTexture(buffer, extension) {
  const texture = extension.toLowerCase() === '.dds' ? decodeDDS(buffer) : PNG.sync.read(buffer);
  const header = Buffer.alloc(8);
  header.writeUInt32LE(texture.width, 0); header.writeUInt32LE(texture.height, 4);
  return Buffer.concat([header, texture.data]);
}
