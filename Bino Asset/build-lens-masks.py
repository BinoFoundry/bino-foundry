#!/usr/bin/env python3
"""Rebuild configurator-assets/{pk002,pk007}-{frame,lens-shape,shade}.png

Strategy:
  1) Flood-fill each lens from a bright/mid seed until frame luminance
  2) Morphological close to seal internal holes / dark reflections
  3) Bounded dilate so the fill tucks under the soft inner rim
  4) Frame hole cut == lens mask (do not erode) so AA fringe is removed
"""
from pathlib import Path
import numpy as np
from PIL import Image
import cv2

BASE = Path(__file__).resolve().parent
OUT = BASE / "configurator-assets"
OUT.mkdir(exist_ok=True)


def lum(im):
    return 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]


def seeds(L, mode):
    h, w = L.shape
    out = []
    for x0, x1 in [(int(w * 0.12), w // 2 - 20), (w // 2 + 20, int(w * 0.88))]:
        roi = L[int(h * 0.28) : int(h * 0.72), x0:x1]
        m = (roi > 140) if mode == "light" else ((roi > 58) & (roi < 115))
        if m.sum() < 2000:
            m = (roi > 42) & (roi < 140)
        ys, xs = np.where(m)
        out.append((int(x0 + xs.mean()), int(0.28 * h + ys.mean())))
    return out


def flood(L, seed, lo, hi):
    h, w = L.shape
    allow = ((L >= lo) & (L <= hi)).astype(np.uint8) * 255
    allow[0, :] = 0
    allow[-1, :] = 0
    allow[:, 0] = 0
    allow[:, -1] = 0
    ff = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(
        allow,
        ff,
        seed,
        128,
        0,
        0,
        4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8),
    )
    return ff[1:-1, 1:-1]


def build_lens(L, mode, lo, hi, close_k, dilate_px):
    m = np.zeros(L.shape, np.uint8)
    for s in seeds(L, mode):
        m = np.maximum(m, flood(L, s, lo, hi))
    m = cv2.morphologyEx(
        m,
        cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k)),
        3,
    )
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(m)
    for c in cnts:
        if cv2.contourArea(c) > 8000:
            cv2.drawContours(filled, [c], -1, 255, -1)

    if dilate_px > 0:
        k = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1)
        )
        num, labels, stats, _ = cv2.connectedComponentsWithStats(filled)
        out = np.zeros_like(filled)
        pad = dilate_px + 10
        for i in range(1, num):
            if stats[i, cv2.CC_STAT_AREA] < 8000:
                continue
            x, y, bw, bh, _ = stats[i]
            x0, y0 = max(0, x - pad), max(0, y - pad)
            x1 = min(L.shape[1], x + bw + pad)
            y1 = min(L.shape[0], y + bh + pad)
            part = np.zeros_like(filled)
            part[labels == i] = 255
            part = cv2.dilate(part, k, 1)
            clip = np.zeros_like(part)
            clip[y0:y1, x0:x1] = part[y0:y1, x0:x1]
            clip[L >= 248] = 0
            out = np.maximum(out, clip)
        filled = out
    return filled


def export(stem, im, L, lens_bin):
    h, w = L.shape
    lens_a = cv2.GaussianBlur(lens_bin, (0, 0), 0.35).astype(np.float64) / 255.0
    hole_a = lens_a.copy()  # same cut — removes AA fringe from frame
    lens_a[L > 249] = 0
    hole_a[L > 249] = 0

    a = lens_a[..., None]
    chk = im.astype(float) * (1 - a * 0.9) + np.array([215.0, 35, 50]) * a * 0.9
    Image.fromarray(np.clip(chk, 0, 255).astype(np.uint8)).save(OUT / f"check-{stem}.png")
    Image.fromarray((lens_a * 255).astype(np.uint8)).save(OUT / f"debug-mask-{stem}.png")

    rgba = np.dstack([im.astype(float), np.ones((h, w)) * 255])
    rgba[..., 3] *= 1 - hole_a
    rgba[L > 250, 3] = 0
    Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8)).save(OUT / f"{stem}-frame.png")

    # Shared undercoat so dark & clear bases tint to the same density.
    # Stronger std keeps temples / highlights readable after multiply.
    REF_MEAN = 128.0
    REF_STD = 70.0
    mbin = lens_a > 0.5
    mean, std = float(L[mbin].mean()), max(float(L[mbin].std()), 4.0)
    z = np.clip((L - mean) / std, -2.5, 2.5)
    plate = REF_MEAN + z * REF_STD
    # Force exact shared mean inside mask (clipping can bias dark vs light)
    plate = plate - float(plate[mbin].mean()) + REF_MEAN
    plate = np.clip(plate, 48, 220)
    plate = plate - float(plate[mbin].mean()) + REF_MEAN
    plate = np.clip(plate, 40, 230)

    shade = np.zeros((h, w, 4), np.uint8)
    g = plate.astype(np.uint8)
    shade[..., 0] = g
    shade[..., 1] = g
    shade[..., 2] = g
    shade[..., 3] = (lens_a * 255).astype(np.uint8)
    Image.fromarray(shade).save(OUT / f"{stem}-shade.png")

    # High-pass detail only (no absolute brightness) → temples/highlights
    # without reintroducing dark-vs-clear density bias.
    blur = cv2.GaussianBlur(im.astype(np.float64), (0, 0), 10.0)
    residual = np.clip(im.astype(np.float64) - blur + 128.0, 0, 255)
    detail = np.dstack(
        [residual.astype(np.uint8), (lens_a * 255).astype(np.uint8)]
    )
    Image.fromarray(detail).save(OUT / f"{stem}-detail.png")

    shape = np.zeros((h, w, 4), np.uint8)
    shape[..., 0:3] = 255
    shape[..., 3] = (lens_a * 255).astype(np.uint8)
    Image.fromarray(shape).save(OUT / f"{stem}-lens-shape.png")

    # Preview: solid color → soft-light shade → soft-light high-pass detail
    color = np.array([0x8F, 0x18, 0x30], dtype=np.float64)

    def overlay(base, blend, amount):
        b = base / 255.0
        d = blend / 255.0
        over = np.where(b <= 0.5, 2 * b * d, 1 - 2 * (1 - b) * (1 - d))
        out = base * (1 - amount[..., None]) + over * 255 * amount[..., None]
        return out

    def soft_light(base, blend, amount):
        b = base / 255.0
        d = blend / 255.0
        soft = np.where(
            b <= 0.5,
            2 * b * d,
            1 - 2 * (1 - b) * (1 - d),
        )
        out = base * (1 - amount[..., None]) + soft * 255 * amount[..., None]
        return out

    canvas = np.ones((h, w, 3)) * 255.0
    for c in range(3):
        canvas[..., c] = canvas[..., c] * (1 - lens_a) + color[c] * lens_a
    plate_rgb = np.stack([plate, plate, plate], axis=-1)
    canvas = overlay(canvas, plate_rgb, lens_a * 0.75)
    canvas = soft_light(canvas, residual, lens_a * 0.65)
    fa = rgba[..., 3] / 255
    for c in range(3):
        canvas[..., c] = canvas[..., c] * (1 - fa) + rgba[..., c] * fa
    Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8)).save(
        OUT / f"{stem}-preview.png"
    )
    print(
        stem,
        "cov",
        int((lens_a > 0.5).sum()),
        "plate",
        round(float(plate[mbin].mean()), 1),
        "±",
        round(float(plate[mbin].std()), 1),
        "RGB",
        np.round(canvas[mbin].mean(0), 1),
    )


def main():
    im = np.array(Image.open(BASE / "PK007 - Front.png").convert("RGB"))
    export("pk007", im, lum(im), build_lens(lum(im), "light", 78, 248, 9, 12))

    im = np.array(Image.open(BASE / "PK002 - Front.png").convert("RGB"))
    export("pk002", im, lum(im), build_lens(lum(im), "dark", 40, 150, 25, 10))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
