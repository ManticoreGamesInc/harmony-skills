#!/usr/bin/env python
"""Store page media beyond the thumbnail, sized to the upload page's rules:

    take-sheet   contact sheet of a recorded take (frames with their times), to pick the clip
    preview      the card's preview movie: a 16:9 clip of at most 6 s and 1.0 MB, muted,
                 MP4 (H.264) or WebM (VP9), with an optional crossfade so it loops cleanly
    background   banner background art: a clean 16:9 frame, 3840x2160 when the frame is big
                 enough (at least 1920x1080), WebP, JPEG or PNG under 10 MB
    portrait     banner mobile portrait: a 9:16 crop of the background art or a portrait frame,
                 1440x2560 when the crop is big enough (at least 1080x1920), WebP, JPEG or PNG
                 under 10 MB
    logo         banner title logo: 1024x1024 transparent PNG, logo centered with at most
                 10 px between it and the nearest edge, a dark outline and shadow baked in
    banner-sheet how the background, portrait and logo look on the banner's screen shapes
                 (16:9, 16:10, 21:9, phone) and the logo on dark, bright and blue backings;
                 with only --logo, just the logo on those backings
    key          makes a solid background color transparent (soft edges, no colored fringe),
                 for title art from an image generator that can't do transparency

    python store_media.py take-sheet --input take_1.webm --out take_1_sheet.png
    python store_media.py preview --input take_1.webm --start 3.5 --out store-media/preview.mp4
    python store_media.py background --shot hero.png --out store-media/banner/background.webp
    python store_media.py portrait --shot store-media/banner/background.webp --focus 0.6,1 --zoom 1.1 --out store-media/banner/portrait.webp
    python store_media.py logo --title logo_square.png --out store-media/banner/logo.png
    python store_media.py key --input title_raw.png --out title.png --trim
    python store_media.py banner-sheet --logo store-media/banner/logo.png --out logo_check.png
    python store_media.py banner-sheet --background store-media/banner/background.webp --portrait store-media/banner/portrait.webp --logo store-media/banner/logo.png --out sheet.png

Needs Pillow; take-sheet and preview need ffmpeg and ffprobe on PATH.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageChops, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compose_thumbnail import cover, fail, parse_size, place, solid, trimmed_title  # noqa: E402

PREVIEW_MAX_SECONDS = 6.0
PREVIEW_MAX_BYTES = 1000000
BACKGROUND_MAX_BYTES = 10 * 1000 * 1000
BACKGROUND_MIN = (1920, 1080)
PORTRAIT_MIN = (1080, 1920)
LOGO_SIZE = 1024
LOGO_MAX_GAP = 10


def parse_pair(text, name):
	try:
		x, y = (float(v) for v in text.split(","))
		return x, y
	except ValueError:
		fail(name + " must look like 0.5,0.5")


def run(cmd):
	r = subprocess.run(cmd, capture_output=True, text=True)
	if r.returncode != 0:
		fail(" ".join(cmd[:3]) + " ... failed:\n" + r.stderr[-1500:])
	return r.stdout


def probe(path):
	"""Duration (seconds), width and height of a video's first stream."""
	out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", path])
	data = json.loads(out)
	stream = data["streams"][0]
	duration = float(data.get("format", {}).get("duration") or 0)
	if duration <= 0:
		# MediaRecorder WebM files carry no duration, and their frame rate can be unknown or
		# variable: measure from the first packet's time to the end of the last one.
		out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,duration_time", "-of", "json", path])
		packets = json.loads(out).get("packets", [])
		times = [float(p["pts_time"]) for p in packets if p.get("pts_time") not in (None, "N/A")]
		if times:
			last = max(times)
			tail = [float(p["duration_time"]) for p in packets if p.get("pts_time") not in (None, "N/A") and float(p["pts_time"]) == last and p.get("duration_time") not in (None, "N/A")]
			duration = last - min(times) + (tail[0] if tail else 0.0)
	return duration, int(stream["width"]), int(stream["height"])


def cover_filter(size, focus):
	"""ffmpeg filters that scale a video to fill size and crop around the focus point."""
	w, h = size
	fx, fy = focus
	return ("scale=" + str(w) + ":" + str(h) + ":force_original_aspect_ratio=increase:flags=lanczos,"
		+ "crop=" + str(w) + ":" + str(h) + ":(iw-" + str(w) + ")*" + str(fx) + ":(ih-" + str(h) + ")*" + str(fy) + ",setsar=1")


def take_sheet(a):
	duration, w, h = probe(a.input)
	step = a.every
	times = []
	t = 0.0
	while t < duration - 0.05 and len(times) < 48:
		times.append(round(t, 2))
		t += step
	cols = 6
	cell_w, cell_h = 320, 180
	rows = (len(times) + cols - 1) // cols
	sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + 22)), (16, 16, 20))
	draw = ImageDraw.Draw(sheet)
	with tempfile.TemporaryDirectory() as tmp:
		pattern = os.path.join(tmp, "f_%04d.png")
		run(["ffmpeg", "-v", "error", "-i", a.input, "-vf", "fps=1/" + str(step) + "," + cover_filter((cell_w, cell_h), (0.5, 0.5)), pattern])
		for i, t in enumerate(times):
			path = os.path.join(tmp, "f_" + str(i + 1).zfill(4) + ".png")
			if not os.path.exists(path):
				break
			x, y = (i % cols) * cell_w, (i // cols) * (cell_h + 22)
			sheet.paste(Image.open(path).convert("RGB"), (x, y))
			draw.text((x + 6, y + cell_h + 4), str(t) + " s", fill=(230, 230, 230))
	sheet.save(a.out)
	print(a.out + "  (" + str(round(duration, 1)) + " s take, " + str(w) + "x" + str(h) + ", a frame every " + str(step) + " s)")


def encode_preview(a, src_filter, duration, bitrate, out):
	"""Two-pass encode at a target bitrate (bits per second)."""
	webm = out.lower().endswith(".webm")
	codec = ["-c:v", "libvpx-vp9", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2"] if webm else ["-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-pix_fmt", "yuv420p"]
	frames = str(int(round(duration * a.fps)))
	common = ["ffmpeg", "-v", "error", "-y", "-i", a.input, "-filter_complex", src_filter, "-map", "[v]", "-an", "-frames:v", frames] + codec + ["-b:v", str(int(bitrate))]
	with tempfile.TemporaryDirectory() as tmp:
		log = os.path.join(tmp, "pass")
		run(common + ["-pass", "1", "-passlogfile", log, "-f", "null", os.devnull])
		extra = ["-pix_fmt", "yuv420p"] if webm else ["-movflags", "+faststart"]
		run(common + ["-pass", "2", "-passlogfile", log] + extra + ["-map_metadata", "-1", out])
	return os.path.getsize(out)


def preview(a):
	size = parse_size(a.size)
	focus = parse_pair(a.focus, "--focus")
	if a.duration > PREVIEW_MAX_SECONDS:
		fail("--duration is at most " + str(PREVIEW_MAX_SECONDS) + " s")
	take_duration, _, _ = probe(a.input)
	loop = max(0.0, a.loop)
	# The clip reads --duration plus the --loop crossfade from the take, starting at --start.
	need = a.duration + loop
	if need > take_duration + 0.05:
		fail("the take is " + str(round(take_duration, 2)) + " s, but the clip needs " + str(round(need, 2)) + " s (--duration " + str(a.duration) + " plus --loop " + str(loop) + "); record a longer take, or lower --duration or --loop")
	if a.start + need > take_duration + 0.05:
		moved = max(0.0, round(take_duration - need, 2))
		print("note: --start " + str(a.start) + " plus " + str(round(need, 2)) + " s (--duration " + str(a.duration) + " plus --loop " + str(loop) + ") runs past the end of the " + str(round(take_duration, 2)) + " s take; starting at " + str(moved) + " instead")
		a.start = moved
	base = ("[0:v]trim=start=" + str(a.start) + ":duration=" + str(need) + ",setpts=PTS-STARTPTS,fps=" + str(a.fps) + "," + cover_filter(size, focus))
	if loop > 0:
		# The clip is the take from loop to duration + loop; its last loop seconds fade into the
		# take's first loop seconds, so the end runs straight back into the start.
		src_filter = (base + ",split[a][b];"
			+ "[a]trim=start=" + str(loop) + ",setpts=PTS-STARTPTS[body];"
			+ "[b]trim=duration=" + str(loop) + ",setpts=PTS-STARTPTS[head];"
			+ "[body][head]xfade=transition=fade:duration=" + str(loop) + ":offset=" + str(round(a.duration - loop, 3)) + ",format=yuv420p[v]")
	else:
		src_filter = base + ",format=yuv420p[v]"
	limit = a.max_bytes
	bitrate = limit * 8 * 0.92 / a.duration
	for attempt in range(5):
		got = encode_preview(a, src_filter, a.duration, bitrate, a.out)
		if got <= limit:
			break
		bitrate *= 0.9 * limit / got
	else:
		fail("couldn't get under " + str(limit) + " bytes (last " + str(got) + "); shorten --duration or lower --size")
	duration, w, h = probe(a.out)
	print(a.out + "  (" + str(w) + "x" + str(h) + ", " + str(round(duration, 2)) + " s, " + str(got) + " bytes of " + str(limit) + ", " + str(round(bitrate / 1000)) + " kbps, no audio)")


def save_under(img, out, max_bytes):
	"""Saves as the extension's format; lossy formats step their quality down until they fit."""
	ext = os.path.splitext(out)[1].lower()
	if ext == ".png":
		img.save(out, optimize=True)
	else:
		fmt = "WEBP" if ext == ".webp" else "JPEG"
		if ext not in (".webp", ".jpg", ".jpeg"):
			fail("--out must end in .webp, .jpg or .png")
		for quality in (94, 90, 86, 82, 76, 70):
			img.save(out, fmt, quality=quality, method=6) if fmt == "WEBP" else img.save(out, fmt, quality=quality, optimize=True, progressive=True)
			if os.path.getsize(out) <= max_bytes:
				return quality
	if os.path.getsize(out) > max_bytes:
		fail(out + " is " + str(os.path.getsize(out)) + " bytes, over " + str(max_bytes) + "; use .webp or .jpg")
	return None


def background(a):
	focus = parse_pair(a.focus, "--focus")
	shot = Image.open(a.shot).convert("RGB")
	tw, th = parse_size(a.size)
	# The largest 16:9 box the frame fills without upscaling, capped at the target size.
	fit = min(shot.width / tw, shot.height / th, 1.0)
	w, h = round(tw * fit), round(th * fit)
	if a.upscale:
		w, h = tw, th
	if w < BACKGROUND_MIN[0] or h < BACKGROUND_MIN[1]:
		fail("the frame is " + str(shot.width) + "x" + str(shot.height) + "; the banner needs at least 1920x1080 at 16:9. Capture at a bigger viewport, or pass --upscale")
	art = cover(shot, (w, h), focus)
	quality = save_under(art, a.out, BACKGROUND_MAX_BYTES)
	note = "" if (w, h) == (tw, th) else " (smaller than " + str(tw) + "x" + str(th) + ": the frame wasn't big enough)"
	print(a.out + "  (" + str(w) + "x" + str(h) + note + ", " + str(os.path.getsize(a.out)) + " bytes" + ("" if quality is None else ", quality " + str(quality)) + ")")


def portrait(a):
	focus = parse_pair(a.focus, "--focus")
	if a.zoom < 1:
		fail("--zoom is 1 or more")
	shot = Image.open(a.shot).convert("RGB")
	# The largest 9:16 box in the frame, made smaller by --zoom so the crop can move up and down
	# a landscape frame, centered on the focus point as far as the frame allows.
	ch = min(shot.height, shot.width * 16 / 9) / a.zoom
	cw = ch * 9 / 16
	x = min(max(shot.width * focus[0] - cw / 2, 0), shot.width - cw)
	y = min(max(shot.height * focus[1] - ch / 2, 0), shot.height - ch)
	crop = shot.crop((round(x), round(y), round(x + cw), round(y + ch)))
	tw, th = parse_size(a.size)
	fit = min(crop.width / tw, crop.height / th, 1.0)
	w, h = round(tw * fit), round(th * fit)
	if a.upscale:
		w, h = tw, th
	if w < PORTRAIT_MIN[0] or h < PORTRAIT_MIN[1]:
		fail("the 9:16 crop is " + str(crop.width) + "x" + str(crop.height) + "; the portrait needs at least " + str(PORTRAIT_MIN[0]) + "x" + str(PORTRAIT_MIN[1]) + ". Lower --zoom, use a bigger frame or capture a portrait frame, or pass --upscale")
	art = crop.resize((w, h), Image.Resampling.LANCZOS)
	quality = save_under(art, a.out, BACKGROUND_MAX_BYTES)
	note = "" if (w, h) == (tw, th) else " (smaller than " + str(tw) + "x" + str(th) + ": the crop wasn't big enough)"
	print(a.out + "  (" + str(w) + "x" + str(h) + note + ", cropped from " + str(round(x)) + "," + str(round(y)) + " size " + str(crop.width) + "x" + str(crop.height) + " of the " + str(shot.width) + "x" + str(shot.height) + " frame, " + str(os.path.getsize(a.out)) + " bytes" + ("" if quality is None else ", quality " + str(quality)) + ")")


def gaps(img):
	"""Empty pixels between the logo (alpha over 8) and each edge: left, top, right, bottom."""
	bbox = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
	return bbox[0], bbox[1], img.width - bbox[2], img.height - bbox[3]


def logo(a):
	title = trimmed_title(a.title)
	# Work big, so outline and shadow widths come out the same at any source size.
	work = 2048
	scale = work / max(title.width, title.height)
	title = title.resize((max(1, round(title.width * scale)), max(1, round(title.height * scale))), Image.Resampling.LANCZOS)
	unit = min(title.width, title.height) * 0.5 + max(title.width, title.height) * 0.1
	radius = max(1, round(unit * a.outline))
	offset = max(2, round(unit * 0.04))
	pad = radius + offset * 3 + 4
	size = (title.width + pad * 2, title.height + pad * 2)
	alpha = title.getchannel("A")
	canvas = Image.new("RGBA", size, (0, 0, 0, 0))
	if a.shadow > 0:
		shadow = place(size, alpha, pad, pad + offset).filter(ImageFilter.GaussianBlur(max(2, offset)))
		shadow = shadow.point(lambda v: round(v * min(a.shadow, 1.0)))
		canvas = Image.alpha_composite(canvas, solid(size, (0, 0, 0), shadow))
	if a.outline > 0:
		grown = place(size, alpha, pad, pad).filter(ImageFilter.MaxFilter(radius * 2 + 1)).filter(ImageFilter.GaussianBlur(1))
		canvas = Image.alpha_composite(canvas, solid(size, (6, 8, 12), grown.point(lambda v: round(v * 0.94))))
	layer = Image.new("RGBA", size, (0, 0, 0, 0))
	layer.paste(title, (pad, pad), title)
	canvas = Image.alpha_composite(canvas, layer)
	bbox = canvas.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
	canvas = canvas.crop(bbox)
	if a.pad > LOGO_MAX_GAP:
		fail("--pad is at most " + str(LOGO_MAX_GAP))
	inner = LOGO_SIZE - 2 * a.pad
	big = canvas
	target = inner
	# Downscaling thins the soft shadow edge below the visible threshold, so measure the result
	# and scale again from the big image until the visible logo spans the inner box.
	for attempt in range(4):
		fit = target / max(big.width, big.height)
		canvas = big.resize((max(1, round(big.width * fit)), max(1, round(big.height * fit))), Image.Resampling.LANCZOS)
		canvas = canvas.crop(canvas.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())
		span = max(canvas.width, canvas.height)
		if inner - 1 <= span <= LOGO_SIZE:
			break
		target += inner - span
	out = Image.new("RGBA", (LOGO_SIZE, LOGO_SIZE), (0, 0, 0, 0))
	# A plain paste onto the empty square: pasting with the logo as its own mask would square its alpha.
	out.paste(canvas, ((LOGO_SIZE - canvas.width) // 2, (LOGO_SIZE - canvas.height) // 2))
	g = gaps(out)
	if min(g) > LOGO_MAX_GAP:
		fail("the logo sits " + str(min(g)) + " px from the nearest edge; the store allows " + str(LOGO_MAX_GAP))
	out.save(a.out, optimize=True)
	fill = round(100 * canvas.width * canvas.height / (LOGO_SIZE * LOGO_SIZE))
	print(a.out + "  (1024x1024, gaps left/top/right/bottom " + "/".join(str(v) for v in g) + " px, logo box fills " + str(fill) + "% of the square" + ("; a wide one-line logo leaves the square mostly empty, consider a square lockup with a taller backing (stack only between whole words, never split a word)" if fill < 40 else "") + ")")


def overlay_ui(img, logo_img, phone):
	"""Rough stand-in for the banner's text side: a dark fade, the logo, two lines and two buttons."""
	w, h = img.size
	canvas = img.convert("RGBA")
	fade = Image.new("L", (w, h), 0)
	px = fade.load()
	for x in range(w):
		for y in range(h):
			t = (y / h - 0.45) / 0.55 if phone else 1.0 - x / (w * 0.55)
			px[x, y] = round(235 * max(0.0, min(1.0, t)))
	canvas = Image.alpha_composite(canvas, solid((w, h), (4, 8, 24), fade))
	draw = ImageDraw.Draw(canvas)
	left = round(w * (0.07 if phone else 0.05))
	text_w = round(w * (0.86 if phone else 0.3))
	bottom = round(h * (0.94 if phone else 0.86))
	button_h = max(6, round(h * (0.045 if phone else 0.06)))
	draw.rounded_rectangle((left, bottom - button_h, left + text_w * 0.45, bottom), radius=button_h // 2, fill=(40, 100, 255))
	draw.rounded_rectangle((left + text_w * 0.5, bottom - button_h, left + text_w * 0.95, bottom), radius=button_h // 2, fill=(245, 245, 250))
	line_h = max(2, round(button_h * 0.28))
	y = bottom - button_h * 2
	for frac in (0.95, 0.7):
		draw.rounded_rectangle((left, y - line_h, left + text_w * frac, y), radius=line_h // 2, fill=(210, 215, 230))
		y -= line_h * 2
	if logo_img is not None:
		side = min(text_w, round(h * (0.25 if phone else 0.42)))
		lg = logo_img.resize((side, side), Image.Resampling.LANCZOS)
		canvas.alpha_composite(lg, (left, max(0, y - side - line_h)))
	return canvas.convert("RGB")


def half_line(img):
	"""The 9:16 portrait with a dashed line across its middle: the subject belongs above it."""
	out = img.copy()
	draw = ImageDraw.Draw(out)
	y = out.height // 2
	for x in range(0, out.width, 12):
		draw.line((x, y, min(out.width, x + 6), y), fill=(255, 64, 160), width=2)
	return out


def banner_sheet(a):
	if not (a.background or a.portrait or a.logo):
		fail("pass --background, --portrait or --logo")
	art = Image.open(a.background).convert("RGB") if a.background else None
	tall = Image.open(a.portrait).convert("RGB") if a.portrait else None
	logo_img = Image.open(a.logo).convert("RGBA") if a.logo else None
	wide = []
	if art is not None:
		for name, size in (("16:9", (640, 360)), ("16:10", (640, 400)), ("21:9 (ultrawide)", (640, 274))):
			wide.append((name, overlay_ui(cover(art, size, (0.5, 0.5)), logo_img, False)))
	# Phones show the mobile portrait when there is one, and the background art otherwise.
	phones = []
	if tall is not None:
		phones.append(("Phone (portrait)", overlay_ui(cover(tall, (186, 404), (0.5, 0.5)), logo_img, True)))
		phones.append(("Portrait 9:16, subject above the line", half_line(cover(tall, (228, 404), (0.5, 0.5)))))
	elif art is not None:
		phones.append(("Phone", overlay_ui(cover(art, (186, 404), (0.5, 0.5)), logo_img, True)))
	backings = []
	if logo_img is not None:
		for name, color in (("dark", (10, 13, 20)), ("bright", (242, 242, 242)), ("blue", (29, 78, 216))):
			tile = Image.new("RGBA", (300, 300), color + (255,))
			tile.alpha_composite(logo_img.resize((300, 300), Image.Resampling.LANCZOS))
			backings.append((name, tile.convert("RGB")))
	gap, label = 16, 20
	left_w = 640 if wide else 0
	right_w = sum(tile.width for _, tile in phones) + gap * max(0, len(phones) - 1)
	width = gap + left_w + (gap if wide and phones else 0) + right_w + gap
	top_h = max(sum(tile.height + label + gap for _, tile in wide), (404 + label + gap) if phones else 0)
	height = gap + top_h + ((300 + label + gap) if backings else 0)
	width = max(width, gap + len(backings) * (300 + gap), 240)
	sheet = Image.new("RGB", (width, height), (232, 236, 245))
	draw = ImageDraw.Draw(sheet)
	y = gap
	for name, tile in wide:
		sheet.paste(tile, (gap, y))
		draw.text((gap, y + tile.height + 4), name, fill=(40, 44, 60))
		y += tile.height + label + gap
	x = gap + left_w + (gap if wide else 0)
	for name, tile in phones:
		sheet.paste(tile, (x, gap))
		draw.text((x, gap + tile.height + 4), name, fill=(40, 44, 60))
		x += tile.width + gap
	y = gap + top_h
	x = gap
	for name, tile in backings:
		sheet.paste(tile, (x, y))
		draw.text((x, y + 300 + 4), "logo on " + name, fill=(40, 44, 60))
		x += 300 + gap
	sheet.save(a.out)
	print(a.out)


def parse_color(text):
	t = text.strip().lstrip("#")
	if len(t) != 6:
		fail("--color must look like #ff00ff")
	return tuple(int(t[i:i + 2], 16) for i in (0, 2, 4))


def corner_color(img):
	"""The background color, read from the four corners; they have to agree."""
	patch = max(2, min(img.width, img.height) // 64)
	colors = []
	for x, y in ((0, 0), (img.width - patch, 0), (0, img.height - patch), (img.width - patch, img.height - patch)):
		box = img.crop((x, y, x + patch, y + patch)).resize((1, 1), Image.Resampling.BOX)
		colors.append(box.getpixel((0, 0))[:3])
	for c in colors[1:]:
		if max(abs(c[i] - colors[0][i]) for i in range(3)) > 40:
			fail("the corners aren't one color (" + ", ".join("#%02x%02x%02x" % c for c in colors) + "); pass --color")
	return tuple(round(sum(c[i] for c in colors) / 4) for i in range(3))


def key(a):
	img = Image.open(a.input).convert("RGBA")
	color = parse_color(a.color) if a.color else corner_color(img)
	rgb = img.convert("RGB")
	bands = rgb.split()
	high = [i for i in range(3) if color[i] >= 128]
	low = [i for i in range(3) if color[i] < 128]
	if high and low and min(color[i] for i in high) - max(color[i] for i in low) >= 128:
		# A saturated key (magenta, green, blue): how much of the key's color a pixel still
		# carries is how much background shows through it. This also keys soft shadows and
		# glows, which a plain color distance leaves tinted.
		strong = bands[high[0]]
		for i in high[1:]:
			strong = ImageChops.darker(strong, bands[i])
		weak = bands[low[0]]
		for i in low[1:]:
			weak = ImageChops.lighter(weak, bands[i])
		spill = ImageChops.subtract(strong, weak)
		span = min(color[i] for i in high) - max(color[i] for i in low)
		alpha = spill.point(lambda v: 255 - min(255, round(255 * v / span)))
		clip = a.clip
		alpha = alpha.point(lambda v: 0 if v <= clip else 255 if v >= 255 - clip else round(255 * (v - clip) / (255 - 2 * clip)))
	else:
		# Any other color: fade by distance from it.
		diff = ImageChops.difference(rgb, Image.new("RGB", img.size, color))
		r, g, b = diff.split()
		dist = ImageChops.lighter(ImageChops.lighter(r, g), b)
		lo = a.tolerance
		hi = a.tolerance + max(1, a.softness)
		alpha = dist.point(lambda v: 0 if v <= lo else 255 if v >= hi else round(255 * (v - lo) / (hi - lo)))
	alpha = ImageChops.multiply(alpha, img.getchannel("A"))
	# Edge pixels are a blend of the art and the key color: take the key color back out, so no
	# colored fringe is left around the letters.
	px = rgb.load()
	al = alpha.load()
	for y in range(img.height):
		for x in range(img.width):
			t = al[x, y]
			if 0 < t < 255:
				f = t / 255
				p = px[x, y]
				px[x, y] = tuple(max(0, min(255, round((p[i] - (1 - f) * color[i]) / f))) for i in range(3))
	out = rgb.convert("RGBA")
	out.putalpha(alpha)
	if alpha.getbbox() is None:
		fail("everything matched the key color; lower --tolerance or pass --color")
	if a.trim:
		bbox = alpha.point(lambda v: 255 if v > 8 else 0).getbbox()
		pad = a.pad
		out = out.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(img.width, bbox[2] + pad), min(img.height, bbox[3] + pad)))
	out.save(a.out, optimize=True)
	clear = round(100 * sum(1 for v in alpha.getdata() if v == 0) / (img.width * img.height))
	print(a.out + "  (" + str(out.width) + "x" + str(out.height) + ", keyed #%02x%02x%02x" % color + ", " + str(clear) + "% of the image now transparent)")


def main():
	p = argparse.ArgumentParser(description="Store page media: preview movie, banner background art, mobile portrait and title logo.")
	sub = p.add_subparsers(dest="command", required=True)

	s = sub.add_parser("take-sheet", help="contact sheet of a recorded take")
	s.add_argument("--input", required=True)
	s.add_argument("--out", required=True)
	s.add_argument("--every", type=float, default=0.5, help="seconds between frames")
	s.set_defaults(func=take_sheet)

	s = sub.add_parser("preview", help="the card's muted preview movie")
	s.add_argument("--input", required=True, help="a take from record(), or any gameplay video")
	s.add_argument("--out", required=True, help=".mp4 (H.264, the default choice) or .webm (VP9)")
	s.add_argument("--start", type=float, default=0.0, help="where the clip starts in the take, seconds; the take needs --duration plus --loop seconds after it (a start too late is moved earlier, with a note)")
	s.add_argument("--duration", type=float, default=PREVIEW_MAX_SECONDS, help="clip length, at most 6 s")
	s.add_argument("--loop", type=float, default=0.4, help="crossfade from the end back into the start, seconds; 0 for a hard cut")
	s.add_argument("--size", default="1280x720")
	s.add_argument("--fps", type=int, default=30)
	s.add_argument("--focus", default="0.5,0.5", help="crop focus x,y in 0..1 when the take isn't 16:9")
	s.add_argument("--max-bytes", type=int, default=PREVIEW_MAX_BYTES)
	s.set_defaults(func=preview)

	s = sub.add_parser("background", help="banner background art")
	s.add_argument("--shot", required=True, help="clean frame, no UI and no text")
	s.add_argument("--out", required=True, help=".webp (recommended), .jpg or .png")
	s.add_argument("--size", default="3840x2160")
	s.add_argument("--focus", default="0.5,0.5")
	s.add_argument("--upscale", action="store_true", help="scale a smaller frame up to --size")
	s.set_defaults(func=background)

	s = sub.add_parser("logo", help="1024x1024 banner title logo")
	s.add_argument("--title", required=True, help="transparent logo (trimmed automatically)")
	s.add_argument("--out", required=True, help=".png")
	s.add_argument("--pad", type=int, default=6, help="gap to the nearest edge, at most 10 px")
	s.add_argument("--outline", type=float, default=0.03, help="dark outline width, 0 for none")
	s.add_argument("--shadow", type=float, default=0.65, help="drop shadow opacity, 0 for none")
	s.set_defaults(func=logo)

	s = sub.add_parser("key", help="make a solid background color transparent")
	s.add_argument("--input", required=True)
	s.add_argument("--out", required=True, help=".png")
	s.add_argument("--color", help="background color like #ff00ff (default: read from the corners)")
	s.add_argument("--clip", type=int, default=16, help="saturated keys: alpha under this becomes clear, over 255 minus this solid")
	s.add_argument("--tolerance", type=int, default=40, help="other keys: channel distance from the key color that is fully transparent")
	s.add_argument("--softness", type=int, default=60, help="other keys: distance over which the edge fades in")
	s.add_argument("--trim", action="store_true", help="crop to the art")
	s.add_argument("--pad", type=int, default=4, help="pixels kept around the art when trimming")
	s.set_defaults(func=key)

	s = sub.add_parser("portrait", help="banner mobile portrait (9:16)")
	s.add_argument("--shot", required=True, help="the banner background art or a portrait frame, no UI and no text")
	s.add_argument("--out", required=True, help=".webp (recommended), .jpg or .png")
	s.add_argument("--size", default="1440x2560")
	s.add_argument("--focus", default="0.5,0.5", help="point of the frame the 9:16 crop centers on, x,y in 0..1 (kept inside the frame)")
	s.add_argument("--zoom", type=float, default=1.0, help="crop a smaller 9:16 box (1.1 = 1/1.1 of the height), so the crop can move up or down a landscape frame")
	s.add_argument("--upscale", action="store_true", help="scale a smaller crop up to --size")
	s.set_defaults(func=portrait)

	s = sub.add_parser("banner-sheet", help="check sheet for the banner")
	s.add_argument("--background", help="banner background art (16:9)")
	s.add_argument("--portrait", help="banner mobile portrait (9:16), shown on the phone tile")
	s.add_argument("--logo", help="banner title logo; with only --logo, the sheet shows the logo on dark, bright and blue")
	s.add_argument("--out", required=True)
	s.set_defaults(func=banner_sheet)

	a = p.parse_args()
	a.func(a)


if __name__ == "__main__":
	main()
