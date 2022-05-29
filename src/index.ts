// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./simple-thumbnail.d.ts" />
import TempHandler from "./TempHandler";
import hasGifsicle from "./has-gifsicle";
import pkg from "../package.json";
import { fetch } from "undici";
import { path as ffprobePath } from "ffprobe-static";
import ffmpegPath from "ffmpeg-static";
import thumb from "simple-thumbnail";
import debug from "debug";
import ffmpeg from "fluent-ffmpeg";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import {
	access,
	copyFile,
	readFile,
	stat,
	writeFile
} from "fs/promises";
import { execSync, spawnSync } from "child_process";
import { Readable } from "stream";
import { createWriteStream } from "fs";

export interface Options {
	gifLength?: number;
	gifOptimizationLevel?: 0 | 1 | 2 | 3;
	staticBase?: string;
}

let gifsicleWarningShowed = false;
/**
 * Create a thumbnail from a post - note that you cannot provide post ids!
 *
 * Note on optimization levels:
 * * 0 - disabled
 * * 1 - Store only the changed portion of each image.
 * * 2 - Store only the changed portion of each image, and use transparency. (default)
 * * 3 - Try several optimization methods (usually slower, sometimes better results).
 *
 * @param {string} input - a direct url, file path, or md5
 * @param {("image" | "gif")} [type="image"] - the type of thumbnail to generate
 * @param {Object} [options]
 * @param {number} [options.gifLength=2.5] - the length of the result in seconds (if type is gif)
 * @param {(0 | 1 | 2 | 3)} [options.gifOptimizationLevel=2] - the level of optimization applied to gifs (requires gifsicle to be installed & in path, see above for info on levels)
 * @param {string} [options.staticBase="https://static1.e621.net/data"] - the base url to fetch videos from
 */
export default async function genThumbnail(input: string, type: "image" | "gif" = "image", options: Options = {}) {
	options = options ?? {};
	options.gifLength = options.gifLength ?? 2.5;
	if (options.gifLength < 0) options.gifLength = 2.5;
	options.gifOptimizationLevel = options.gifOptimizationLevel ?? 2;
	if (options.gifOptimizationLevel < 0 || options.gifOptimizationLevel > 3) options.gifOptimizationLevel = 2;
	options.staticBase = options.staticBase ?? "https://static1.e621.net/data";
	const canOptimizeGif = await hasGifsicle();
	if (type === "gif" && !canOptimizeGif && !gifsicleWarningShowed) {
		gifsicleWarningShowed = true;
		process.emitWarning("Gifsicle is not installed, gif files will not be optimized!");
	}
	let fileInput = false;
	const id = randomBytes(16).toString("hex");
	const short = id.slice(0, 5);
	debug(`e621-thumbnailer:id:${short}`)("Randomly Assigned ID: %s (short: %s)", id, short);
	const initalFile = `${tmpdir()}/thumbnailer-${id}.webm`;
	const cutFile = `${tmpdir()}/thumbnailer-${id}.cut.webm`;
	const outFile = `${tmpdir()}/thumbnailer-${id}.final.${type === "image" ? "png" : "gif"}`;
	const optimizedFile = `${tmpdir()}/thumbnailer-${id}.optimized.gif`;
	if (!input.includes("http")) {
		if (/^[a-f\d]{32}$/i.test(input.toLowerCase())) input = `${options.staticBase}/${input.slice(0, 2)}/${input.slice(2, 4)}/${input}.webm`;
		else if (await access(input).then(() => true, () => false)) {
			await copyFile(input, initalFile);
			fileInput = true;
		} else throw new Error("Unable to determine input type.");
	}
	if (!["image", "gif"].includes(type)) throw new Error(`Invalid thumbnail type: ${type}`);
	if (!fileInput) {
		debug(`e621-thumbnailer:download:${id.slice(0, 5)}`)("Downloading %s", input);
		const req = await fetch(input, {
			method:  "GET",
			headers: {
				"User-Agent": `E621Thumbnailer/${pkg.version} (https://github.com/DonovanDMC/E621Thumbnailer)`
			}
		});
		debug(`e621-thumbnailer:download:${short}`)("Download Finished");
		if (req.status !== 200) throw new Error(`Failed to fetch "${input}": ${req.status} ${req.statusText}`);
		if (req.body) Readable.from(req.body).pipe(createWriteStream(initalFile));
		else await writeFile(initalFile, Buffer.from(await req.arrayBuffer()));
	}
	TempHandler.add(initalFile);
	let len = 0;
	debug(`e621-thumbnailer:probe:${short}`)("Determining total length..");
	const [,hour, minute, second] = spawnSync(ffprobePath, [initalFile]).stderr.toString().match(/Duration: (\d\d):(\d\d):(\d\d\.\d\d)/) || ["0", "0", "0", "0"];
	len += Number(hour)   * 3600;
	len += Number(minute) * 60;
	len += Number(second);
	debug(`e621-thumbnailer:probe:${short}`)("Length determined: %d", len);
	let offset = Math.floor(Math.random() * len);
	if (offset > len) offset = 0;
	const start = `00:${Math.floor(offset / 60).toString().padStart(2, "0")}:${(offset % 60).toString().padStart(2, "0")}`;
	switch (type) {
		case "image": {
			debug(`e621-thumbnailer:process:${short}`)("Selecting thumbnail at: %s", start);
			await thumb(initalFile, outFile, "100%", {
				path: ffmpegPath,
				seek: start
			});
			debug(`e621-thumbnailer:process:${short}`)("Finished.");
			TempHandler.add(outFile);
			console.log(outFile);
			const contents = await readFile(outFile);
			await TempHandler.remove(initalFile, outFile);
			return contents;
		}

		case "gif": {
			debug(`e621-thumbnailer:process:${short}`)("Selecting thumbnail at: %s", start);
			const paletteFile = `${tmpdir()}/thumbnailer-${id}.palette.png`;
			debug(`e621-thumbnailer:cut:${short}`)("Cutting file down to %d second(s)", options.gifLength);
			await new Promise<void>((a,b) => {
				ffmpeg(initalFile)
					.setFfmpegPath(ffmpegPath)
					.setFfprobePath(ffprobePath)
					.setStartTime(offset)
					.setDuration(options.gifLength!)
					.noAudio()
					.output(cutFile)
					.on("end", (err) => err ? b(err) : a())
					.on("error", function (err) {
						console.log("error: ", err);
						b(err);
					})
					.run();
			});
			debug(`e621-thumbnailer:cut:${short}`)("Cutting done.");
			TempHandler.add(cutFile);

			debug(`e621-thumbnailer:palette:${short}`)("Generating color palette..");
			await new Promise<void>((a,b) => {
				ffmpeg(cutFile)
					.videoFilter("palettegen")
					.output(paletteFile)
					.on("end", (err) => err ? b(err) : a())
					.on("error", function (err) {
						console.log("error: ", err);
						b(err);
					})
					.run();
			});
			debug(`e621-thumbnailer:palette:${short}`)("Generation done.");
			TempHandler.add(paletteFile);

			debug(`e621-thumbnailer:convert:${short}`)("Converting cut to gif.");
			await new Promise<void>((a,b) => {
				ffmpeg(cutFile)
					.input(paletteFile)
					.complexFilter("paletteuse")
					.output(outFile)
					.on("end", (err) => err ? b(err) : a())
					.on("error", function (err) {
						console.log("error: ", err);
						b(err);
					})
					.run();
			});
			debug(`e621-thumbnailer:convert:${short}`)("Conversion done.");
			debug(`e621-thumbnailer:process:${short}`)("Finished.");
			TempHandler.add(outFile);

			if (canOptimizeGif && options.gifOptimizationLevel > 0) {
				debug(`e621-thumbnailer:optimize:${short}`)("Optimizing.. (level: %d)", options.gifOptimizationLevel);
				execSync(`gifsicle -O2 ${outFile} -o ${optimizedFile}`);
				const ogSize = (await stat(outFile)).size;
				const newSize = (await stat(optimizedFile)).size;
				debug(`e621-thumbnailer:optimize:${short}`)("Optimized! %dMB -> %dMB", (ogSize / 1000 / 1000).toString().slice(0, 5), (newSize / 1000 / 1000).toString().slice(0, 5));
			}
			const contents = await readFile(canOptimizeGif ? optimizedFile : outFile);
			await TempHandler.remove(initalFile, cutFile, paletteFile, outFile);
			if (canOptimizeGif) await TempHandler.remove(optimizedFile);
			return contents;
		}

		default: throw new Error(`Invalid type "${type as string}"`);
	}
}
