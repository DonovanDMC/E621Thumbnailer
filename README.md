# e621-thumbnailer

Generate image and animated thumbnails from e621 videos.

> **Note:** thumbnail generation takes 5–20 seconds depending on input size and type. Pre-generate in bulk rather than on demand.

## Requirements

- Node.js ≥ 20.19.0
- `ffmpeg` and `ffprobe` — either install [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static) and [`ffprobe-static`](https://www.npmjs.com/package/ffprobe-static) as dependencies, or ensure the binaries are in `PATH`
- `gifsicle` in `PATH` — optional, enables GIF optimisation

## Installation

```sh
npm install e621-thumbnailer

# optional: bundled ffmpeg/ffprobe (no system install required)
npm install ffmpeg-static ffprobe-static
```

## Library usage

```ts
import thumbnail from "e621-thumbnailer";
```

The default export is an async function:

```ts
thumbnail(input: string | number, options?: ThumbnailOptions): Promise<Thumbnail>
```

`input` accepts:

| Value | Resolved as |
|-------|-------------|
| Number | e621 post ID — fetched via the API |
| 32-char hex string | MD5 hash — post resolved via the API |
| String starting with `http://` or `https://` | Direct URL, downloaded |
| Any other string | Local file path |

The returned `Thumbnail` object has three methods:

```ts
// Copy the file to a permanent location
await thumb.save("./out.png");

// Get the raw bytes without saving to disk
const buf: Buffer = await thumb.toBuffer();

// Delete the underlying temp file (called automatically on process exit)
await thumb.delete();
```

### Examples

```ts
import thumbnail from "e621-thumbnailer";

// PNG from a post ID
const thumb = await thumbnail(4505261);
await thumb.save("thumb.png");
await thumb.delete();

// JPEG from an MD5 hash
const thumb = await thumbnail("a51d55b12e7a16a37253783e52c4ec21", { format: "jpg" });
const buf = await thumb.toBuffer(); // use as buffer instead of saving

// Animated GIF from a URL
const thumb = await thumbnail("https://static1.e621.net/data/3c/6c/3c6c18c18c096b5a7ff2fa3bdecf3a63.webm", {
    type: "animated",
    length: 3,
    gifOptimizationLevel: 2,
});
await thumb.save("clip.gif");
await thumb.delete();

// Animated WebP from a local file
const thumb = await thumbnail("./video.webm", {
    type: "animated",
    format: "webp",
});
await thumb.save("clip.webp");
await thumb.delete();
```

### Options

#### Image options (`type?: "image"`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `"png" \| "jpg" \| "webp"` | `"png"` | Output format |
| `width` | `number` | `0` | Scale width in pixels; `0` = original size |
| `jpegQuality` | `number` | `2` | JPEG quality (1–31, lower = better) |
| `webpQuality` | `number` | `85` | WebP quality (0–100) |

#### Animated options (`type: "animated"`)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `"gif" \| "webp"` | `"gif"` | Output format |
| `length` | `number` | `2.5` | Clip duration in seconds |
| `fps` | `number` | `15` | Frames per second |
| `width` | `number` | `480` | Output width in pixels |
| `colors` | `number` | `128` | GIF palette size (2–256) |
| `gifOptimizationLevel` | `0 \| 1 \| 2 \| 3` | `0` | Gifsicle optimisation level; `0` = disabled |
| `quality` | `number` | `75` | WebP quality (0–100) |

#### Shared options (both types)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ffmpegPath` | `string` | auto | Path to `ffmpeg` binary |
| `ffprobePath` | `string` | auto | Path to `ffprobe` binary |

## CLI usage

```
e621-thumbnailer <input> [options]
```

`input` accepts the same values as the library function (post ID, MD5, URL, or file path).

```sh
# PNG thumbnail for post 4505261 → ./thumbnail.png
e621-thumbnailer 4505261

# Animated GIF with optimisation
e621-thumbnailer 4505261 -t animated --gif-optimize 2 -o clip.gif

# Animated WebP from an MD5 hash
e621-thumbnailer a51d55b12e7a16a37253783e52c4ec21 -t animated -f webp -o clip.webp

# JPEG from a local file at a specific width
e621-thumbnailer ./video.webm -f jpg -w 640 -o thumb.jpg

# Write PNG to stdout and pipe into another tool
e621-thumbnailer 4505261 -o - | display
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `-o, --output <path>` | `./thumbnail.<fmt>` | Output file path; use `-` to write to stdout |
| `-t, --type <type>` | `image` | `image` or `animated` |
| `-f, --format <fmt>` | `png` / `gif` | Format (see options tables above) |
| `-w, --width <px>` | `0` / `480` | Scale width |
| `--length <s>` | `2.5` | Animated clip duration |
| `--fps <n>` | `15` | Animated fps |
| `--colors <n>` | `128` | GIF palette size |
| `--quality <n>` | `75` | Animated WebP quality |
| `--webp-quality <n>` | `85` | Image WebP quality |
| `--jpeg-quality <n>` | `2` | JPEG quality (1–31) |
| `--gif-optimize <0-3>` | `0` | Gifsicle optimisation level |
| `--ffmpeg <path>` | auto | Path to `ffmpeg` |
| `--ffprobe <path>` | auto | Path to `ffprobe` |
| `-h, --help` | | Print help and exit |

A man page is also installed: `man e621-thumbnailer`.

## GIF file size

The default settings apply several techniques to keep GIFs small:

- **Single-pass palette** — `palettegen` and `paletteuse` run in one ffmpeg filtergraph, avoiding a separate palette file
- **Bayer dithering** with `diff_mode=rectangle` — only changed regions are re-encoded per frame
- **480 px width, 15 fps** — reducing these two values has the largest impact on size
- **128-colour palette** — half the GIF maximum of 256

A 2.5-second clip typically comes out at 3–8 MB versus 40+ MB with default ffmpeg settings. For the smallest possible output, use `format: "webp"` — animated WebP achieves comparable quality at roughly a quarter of the GIF size.
