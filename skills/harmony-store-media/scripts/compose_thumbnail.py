#!/usr/bin/env python
"""Composes a store thumbnail for a web game: crops and scales a clean game frame to the
target size (1280x720 by default) and lays a transparent title logo over it.
The title has to stand out from the frame, so it gets a dark scrim behind it,
a dark outline, a drop shadow and a glow in its own brightest color. The frame
itself is never repainted.

    python compose_thumbnail.py --shot frame.png --title title.png --out thumbnail.png
        [--clean-out screenshot.png] [--title-out title.png] [--size 1280x720]
        [--anchor center] [--title-width 0.9] [--max-title-height 0.66]
        [--margin 0.1] [--top-margin 0.3] [--scrim 0.6] [--outline 0.035] [--shadow 0.7]
        [--glow 0.5] [--focus 0.5,0.5] [--text-center 0.5,0.5]

--text-center is where the main wordmark's middle sits inside the trimmed logo
(fractions of its width and height). Lockups often carry a crest above the words
or a banner below them, so the box's middle isn't the words' middle; centered
anchors line the wordmark up with the image's center instead of the box.
"""

import argparse
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ANCHORS = {
	"center": (0.5, 0.5),
	"top": (0.5, 0.0),
	"bottom": (0.5, 1.0),
	"left": (0.0, 0.5),
	"right": (1.0, 0.5),
	"top-left": (0.0, 0.0),
	"top-right": (1.0, 0.0),
	"bottom-left": (0.0, 1.0),
	"bottom-right": (1.0, 1.0),
}


def fail(message):
	print("error: " + message, file=sys.stderr)
	sys.exit(1)


def parse_size(text):
	try:
		w, h = text.lower().split("x")
		return int(w), int(h)
	except ValueError:
		fail("--size must look like 1280x720")


def cover(img, size, focus):
	"""Scales img to fill size, cropping the overflow around the focus point (0..1, 0..1)."""
	tw, th = size
	scale = max(tw / img.width, th / img.height)
	sw, sh = max(tw, round(img.width * scale)), max(th, round(img.height * scale))
	scaled = img.resize((sw, sh), Image.Resampling.LANCZOS)
	left = min(max(round(sw * focus[0] - tw / 2), 0), sw - tw)
	top = min(max(round(sh * focus[1] - th / 2), 0), sh - th)
	return scaled.crop((left, top, left + tw, top + th))


def trimmed_title(path):
	title = Image.open(path).convert("RGBA")
	alpha = title.getchannel("A")
	if alpha.getextrema()[0] == 255:
		fail("the title has no transparency; run store_media.py key on it first")
	bbox = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
	if bbox is None:
		fail("the title image is fully transparent")
	return title.crop(bbox)


def place(size, mask, x, y):
	"""A full-size L mask with mask pasted at (x, y)."""
	out = Image.new("L", size, 0)
	out.paste(mask, (x, y))
	return out


def solid(size, color, mask):
	layer = Image.new("RGBA", size, tuple(color) + (255,))
	layer.putalpha(mask)
	return layer


def darken(canvas, mask):
	return Image.composite(Image.new("RGBA", canvas.size, (0, 0, 0, 255)), canvas, mask)


def scrim_mask(size, title_size, x, y, ay, strength):
	"""Dark band fading in from the edge the title sits on (top or bottom), plus a feathered
	ellipse right behind the logo. Titles away from the top and bottom edges get the ellipse only."""
	w, h = size
	tw, th = title_size
	mask = Image.new("L", size, 0)
	if ay in (0.0, 1.0):
		reach = (y + th + th * 0.9) if ay == 0.0 else (h - y + th * 0.9)
		reach = max(1.0, min(reach, h * 0.75))
		band = Image.new("L", (1, h), 0)
		for row in range(h):
			d = row if ay == 0.0 else h - 1 - row
			t = max(0.0, 1.0 - d / reach)
			band.putpixel((0, row), round(255 * strength * 0.85 * t * t * (3 - 2 * t)))
		mask = band.resize(size)
	ellipse = Image.new("L", size, 0)
	pad_x, pad_y = tw * 0.3, th * 0.6
	ImageDraw.Draw(ellipse).ellipse((x - pad_x, y - pad_y, x + tw + pad_x, y + th + pad_y), fill=round(255 * strength))
	ellipse = ellipse.filter(ImageFilter.GaussianBlur(max(8, th * 0.45)))
	return ImageChops.lighter(mask, ellipse)


def highlight_color(title):
	"""Average color of the brightest tenth of the logo's opaque pixels."""
	small = title.copy()
	small.thumbnail((256, 256))
	pixels = [p for p in small.getdata() if p[3] > 160]
	if not pixels:
		return (255, 255, 255)
	pixels.sort(key=lambda p: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2], reverse=True)
	top = pixels[:max(1, len(pixels) // 10)]
	return tuple(round(sum(p[i] for p in top) / len(top)) for i in range(3))


def main():
	p = argparse.ArgumentParser(description="Compose a titled game thumbnail.")
	p.add_argument("--shot", required=True, help="clean game frame (any size)")
	p.add_argument("--out", required=True, help="titled thumbnail to write")
	p.add_argument("--title", help="transparent title logo (omit for a clean thumbnail)")
	p.add_argument("--clean-out", help="also write the cropped frame without the title here")
	p.add_argument("--title-out", help="also write the trimmed title logo here")
	p.add_argument("--size", default="1280x720")
	p.add_argument("--anchor", default="center", choices=sorted(ANCHORS), help="where the title sits (center by default; top = top center)")
	p.add_argument("--title-width", type=float, default=0.9, help="max title width as a fraction of the image width")
	p.add_argument("--max-title-height", type=float, default=0.66, help="max title height as a fraction of the image height")
	p.add_argument("--margin", type=float, default=0.1, help="edge margin as a fraction of the image height")
	p.add_argument("--top-margin", type=float, default=0.3, help="gap above a title placed at the top, as a fraction of the image height; keeps it clear of the edge, where it can be covered or cropped")
	p.add_argument("--scrim", type=float, default=0.6, help="darkening behind the title, 0 to 1")
	p.add_argument("--outline", type=float, default=0.035, help="dark outline width as a fraction of the title height, 0 for none")
	p.add_argument("--shadow", type=float, default=0.7, help="title drop shadow opacity, 0 to 1")
	p.add_argument("--glow", type=float, default=0.5, help="halo in the title's brightest color, 0 to 1")
	p.add_argument("--focus", default="0.5,0.5", help="crop focus x,y in 0..1 when the frame's aspect differs")
	p.add_argument("--text-center", default="0.5,0.5", help="the wordmark's middle inside the logo, x,y in 0..1; centered anchors put this point on the image's center line")
	a = p.parse_args()

	size = parse_size(a.size)
	try:
		focus = tuple(float(v) for v in a.focus.split(","))
	except ValueError:
		fail("--focus must look like 0.5,0.5")
	try:
		text_cx, text_cy = (float(v) for v in a.text_center.split(","))
	except ValueError:
		fail("--text-center must look like 0.5,0.42")

	frame = cover(Image.open(a.shot).convert("RGB"), size, focus)
	if a.clean_out:
		frame.save(a.clean_out, optimize=True)
		print(a.clean_out)

	if not a.title:
		frame.save(a.out, optimize=True)
		print(a.out)
		return

	title = trimmed_title(a.title)
	if a.title_out:
		title.save(a.title_out, optimize=True)
		print(a.title_out)

	w, h = size
	fit = min(w * a.title_width / title.width, h * a.max_title_height / title.height)
	title = title.resize((max(1, round(title.width * fit)), max(1, round(title.height * fit))), Image.Resampling.LANCZOS)
	margin = round(h * a.margin)
	ax, ay = ANCHORS[a.anchor]
	x = round(margin + (w - 2 * margin - title.width) * ax)
	y = round(h * a.top_margin) if ay == 0.0 else round(margin + (h - 2 * margin - title.height) * ay)
	# Centered axes line up the wordmark, not the logo's box, with the image's center (kept on screen).
	if ax == 0.5:
		x = min(max(round(w / 2 - title.width * text_cx), 0), w - title.width)
	if ay == 0.5:
		y = min(max(round(h / 2 - title.height * text_cy), 0), h - title.height)

	canvas = frame.convert("RGBA")
	alpha = title.getchannel("A")

	if a.scrim > 0:
		canvas = darken(canvas, scrim_mask(size, title.size, x, y, ay, min(a.scrim, 1.0)))

	if a.glow > 0:
		# Soft halo in the logo's own brightest color, so it lifts off the scene.
		halo = place(size, alpha, x, y).filter(ImageFilter.GaussianBlur(max(4, title.height * 0.22)))
		halo = halo.point(lambda v: min(255, round(v * 1.6 * min(a.glow, 1.0))))
		canvas = Image.alpha_composite(canvas, solid(size, highlight_color(title), halo))

	if a.shadow > 0:
		offset = max(2, round(title.height * 0.05))
		shadow = place(size, alpha, x, y + offset).filter(ImageFilter.GaussianBlur(max(2, title.height * 0.06)))
		shadow = shadow.point(lambda v: round(v * min(a.shadow, 1.0)))
		canvas = Image.alpha_composite(canvas, solid(size, (0, 0, 0), shadow))

	if a.outline > 0:
		# Dark rim traced around every letter.
		radius = max(1, round(title.height * a.outline))
		pad = radius + 2
		grown = Image.new("L", (title.width + pad * 2, title.height + pad * 2), 0)
		grown.paste(alpha, (pad, pad))
		grown = grown.filter(ImageFilter.MaxFilter(radius * 2 + 1)).filter(ImageFilter.GaussianBlur(1))
		rim = place(size, grown, x - pad, y - pad).point(lambda v: round(v * 0.92))
		canvas = Image.alpha_composite(canvas, solid(size, (6, 8, 12), rim))

	layer = Image.new("RGBA", size, (0, 0, 0, 0))
	layer.paste(title, (x, y), title)
	canvas = Image.alpha_composite(canvas, layer)
	canvas.convert("RGB").save(a.out, optimize=True)
	print(a.out)


if __name__ == "__main__":
	main()
