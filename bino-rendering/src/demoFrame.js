/** Procedural demo assets matching the reference wayfarer silhouette. */
export function createDemoAssets() {
  const width = 1200;
  const height = 900;

  const back = document.createElement('canvas');
  back.width = width;
  back.height = height;
  const bctx = back.getContext('2d');
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0, 0, width, height);

  bctx.strokeStyle = '#111';
  bctx.lineWidth = 28;
  bctx.lineCap = 'round';
  // Temples visible through lenses
  bctx.beginPath();
  bctx.moveTo(width * 0.08, height * 0.48);
  bctx.quadraticCurveTo(width * 0.22, height * 0.46, width * 0.34, height * 0.49);
  bctx.stroke();
  bctx.beginPath();
  bctx.moveTo(width * 0.92, height * 0.48);
  bctx.quadraticCurveTo(width * 0.78, height * 0.46, width * 0.66, height * 0.49);
  bctx.stroke();

  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const fctx = frame.getContext('2d');
  fctx.clearRect(0, 0, width, height);

  const lensLeft = { cx: width * 0.335, cy: height * 0.49, rx: width * 0.12, ry: height * 0.078 };
  const lensRight = { cx: width * 0.665, cy: height * 0.49, rx: width * 0.12, ry: height * 0.078 };

  fctx.fillStyle = '#0d0d0d';
  fctx.strokeStyle = '#0d0d0d';
  fctx.lineWidth = 36;
  fctx.lineJoin = 'round';

  drawFrameRim(fctx, lensLeft, lensRight, width, height);

  // Cut transparent lens holes
  fctx.globalCompositeOperation = 'destination-out';
  for (const lens of [lensLeft, lensRight]) {
    fctx.beginPath();
    fctx.ellipse(lens.cx, lens.cy, lens.rx - 6, lens.ry - 4, 0, 0, Math.PI * 2);
    fctx.fill();
  }

  const frameImage = canvasToImage(frame);
  const backImage = canvasToImage(back);

  return {
    frameImage,
    backImage,
    regions: [
      { x: 33.5, y: 49, w: 24, h: 15.5, rotation: -1.5 },
      { x: 66.5, y: 49, w: 24, h: 15.5, rotation: 1.5 },
    ],
  };
}

function drawFrameRim(ctx, left, right, width, height) {
  const bridgeW = width * 0.06;
  const topY = height * 0.42;

  ctx.beginPath();
  // Left rim
  ctx.ellipse(left.cx, left.cy, left.rx + 18, left.ry + 20, 0, Math.PI * 0.15, Math.PI * 1.85);
  ctx.lineTo(left.cx + left.rx * 0.2, topY);
  // Bridge
  ctx.lineTo(width * 0.5 - bridgeW, topY + 8);
  ctx.quadraticCurveTo(width * 0.5, topY + 22, width * 0.5 + bridgeW, topY + 8);
  // Right rim
  ctx.lineTo(right.cx - right.rx * 0.2, topY);
  ctx.ellipse(right.cx, right.cy, right.rx + 18, right.ry + 20, 0, Math.PI * 1.15, Math.PI * 1.85);
  ctx.closePath();
  ctx.fill();

  // Hinge blocks
  for (const lens of [left, right]) {
    const side = lens.cx < width / 2 ? -1 : 1;
    ctx.fillRect(lens.cx + side * (lens.rx + 10), lens.cy - 20, 44, 40);
  }
}

function canvasToImage(canvas) {
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  return new Promise((resolve) => {
    img.onload = () => resolve(img);
  });
}
