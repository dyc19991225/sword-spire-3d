import json
import os
import sys
from collections import deque
from PIL import Image, ImageEnhance, ImageFilter

OUT_DIR = r"E:\ai\sword-spire-3d\public\art"
os.makedirs(OUT_DIR, exist_ok=True)


def process_stage_bg(src_path: str, out_name: str):
    im = Image.open(src_path).convert("RGB")
    target_w, target_h = 1440, 810
    src_ratio = im.width / im.height
    tgt_ratio = target_w / target_h
    if src_ratio > tgt_ratio:
        new_w = int(im.height * tgt_ratio)
        left = (im.width - new_w) // 2
        im = im.crop((left, 0, left + new_w, im.height))
    else:
        new_h = int(im.width / tgt_ratio)
        top = (im.height - new_h) // 2
        im = im.crop((0, top, im.width, top + new_h))
    im = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    out_path = os.path.join(OUT_DIR, out_name)
    im.save(out_path, "WEBP", quality=86, method=6)
    print(f"Saved stage BG: {out_name} ({os.path.getsize(out_path)} bytes)")


def process_card_art(src_path: str, out_name: str):
    im = Image.open(src_path).convert("RGB")
    side = min(im.width, im.height)
    left = (im.width - side) // 2
    top = (im.height - side) // 2
    im = im.crop((left, top, left + side, top + side))
    im = im.resize((384, 384), Image.Resampling.LANCZOS)
    im = ImageEnhance.Contrast(im).enhance(1.08)
    im = ImageEnhance.Color(im).enhance(1.08)
    out_path = os.path.join(OUT_DIR, out_name)
    im.save(out_path, "WEBP", quality=88, method=6)
    print(f"Saved card art: {out_name} ({os.path.getsize(out_path)} bytes)")


def extract_black_bg_standee(src_path: str, out_name: str, target_h: int = 620):
    """
    Corner-seeded flood-fill matte extractor for characters painted on solid #000000.
    Preserves 100% opaque dark robes/hair inside the character while cleanly removing
    the exterior black backdrop and softly feathering glowing weapon/magic auras!
    """
    im = Image.open(src_path).convert("RGBA")
    w, h = im.size
    px = im.load()

    # Estimate corner background color (handles #000000 or slight dark grey #08080c)
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4

    def color_dist(r, g, b):
        return max(abs(r - bg_r), abs(g - bg_g), abs(b - bg_b))

    visited = bytearray(w * h)
    exterior = bytearray(w * h)
    q = deque()

    # Seed from all 4 borders
    for x in range(w):
        for y in (0, h - 1):
            idx = y * w + x
            visited[idx] = 1
            q.append((x, y))
    for y in range(1, h - 1):
        for x in (0, w - 1):
            idx = y * w + x
            visited[idx] = 1
            q.append((x, y))

    PASS_THRESH = 15
    while q:
        cx, cy = q.popleft()
        r, g, b, _ = px[cx, cy]
        d = color_dist(r, g, b)
        if d <= PASS_THRESH:
            idx = cy * w + cx
            exterior[idx] = 1
            for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    nidx = ny * w + nx
                    if not visited[nidx]:
                        visited[nidx] = 1
                        q.append((nx, ny))

    # Build crisp ink-preserving alpha mask with 1px anti-aliased edge
    alpha_img = Image.new("L", (w, h), 255)
    apx = alpha_img.load()
    for y in range(h):
        row_off = y * w
        for x in range(w):
            if exterior[row_off + x]:
                r, g, b, _ = px[x, y]
                d = color_dist(r, g, b)
                if d <= 7:
                    apx[x, y] = 0
                else:
                    apx[x, y] = int(min(255, ((d - 7) / (PASS_THRESH - 7)) * 220))

    alpha_smooth = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.7))
    spx = alpha_smooth.load()

    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            a = spx[x, y]
            if a < 10:
                px[x, y] = (0, 0, 0, 0)
            else:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, a)
                if a > 32:
                    if x < min_x: min_x = x
                    if y < min_y: min_y = y
                    if x > max_x: max_x = x
                    if y > max_y: max_y = y

    if max_x > min_x and max_y > min_y:
        pad = 12
        c_l = max(0, min_x - pad)
        c_t = max(0, min_y - pad)
        c_r = min(w, max_x + pad)
        c_b = min(h, max_y + pad)
        im = im.crop((c_l, c_t, c_r, c_b))

    scale = target_h / max(1, im.height)
    new_w = max(1, int(round(im.width * scale)))
    im = im.resize((new_w, target_h), Image.Resampling.LANCZOS)

    out_path = os.path.join(OUT_DIR, out_name)
    im.save(out_path, "WEBP", quality=90, method=6)
    print(f"Saved alpha standee: {out_name} ({im.width}x{im.height}, {os.path.getsize(out_path)} bytes)")


def main():
    manifest_path = sys.argv[1]
    with open(manifest_path, "r", encoding="utf-8") as f:
        mapping = json.load(f)

    for key, src in mapping["stages"].items():
        process_stage_bg(src, f"{key}.webp")
    for key, src in mapping["standees"].items():
        th = 680 if key.startswith("boss_") else 600
        extract_black_bg_standee(src, f"{key}.webp", target_h=th)
    for key, src in mapping["cards"].items():
        process_card_art(src, f"{key}.webp")


if __name__ == "__main__":
    main()
