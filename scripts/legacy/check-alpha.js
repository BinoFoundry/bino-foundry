const fs = require('fs');
const { PNG } = require('pngjs');

function analyze(file) {
  if (!fs.existsSync(file)) {
    console.log(file, 'not found');
    return;
  }
  const img = PNG.sync.read(fs.readFileSync(file));
  let opaque = 0;
  let semi = 0;
  let trans = 0;
  
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] === 255) opaque++;
    else if (img.data[i] === 0) trans++;
    else semi++;
  }
  console.log(file, `w:${img.width} h:${img.height}`, `opaque:${opaque} semi:${semi} trans:${trans}`);
}

['public/PK002.png', 'public/PK008.png', 'public/PK008_-_CLEAR.png'].forEach(analyze);
