## E621 Thumbnail
Generate image & gif thumbnails for videos from e621. Note this module can take upwards of 15 seconds to generate a single thumbnail, you should not keep things waiting for generated thumbnails. If you absolutely NEED them, you should pregenerate them in bulk.

### Usage
(any needed temporary files are stored in your operating system's default temporary directory, and are removed once they are no longer needed)
```ts
// const genThumbnail = require("e621-thumbnailer");
import genThumbnail from "e621-thumbnailer";

// assuming top level await
// this is specifically the one I used for testing, and it *IS* NSFW
const imageThumb = await genThumbnail("https://static1.e621.net/data/a5/1d/a51d55b12e7a16a37253783e52c4ec21.webm", "image");
// imageThumb is a buffer of image data, which is the thumbnail
// example: https://thumbs.yiff.media/a51d55b12e7a16a37253783e52c4ec21.png

const gifThumb = await genThumbnail("https://static1.e621.net/data/a5/1d/a51d55b12e7a16a37253783e52c4ec21.webm", {
	// defaults
	// the length of the resulting gif, in seconds - increasing this will increase the runtime and SIGNIFICANTLY increase the filesize
	// 2.5 seconds will generally be 40mb, and 5 seconds will be 100+
	gifLength: 2.5,
	// the level of optimization applied to the resulting gif, this will increase the runtime slightly (requires gifsicle to be installed and in your path)
	// * 0 - disabled
	// * 1 - Store only the changed portion of each image.
	// * 2 - Store only the changed portion of each image, and use transparency. (default)
	// * 3 - Try several optimization methods (usually slower, sometimes better results).
	gifOptimizationLevel: 2
});
// gifThumb is a buffer of image data, which is the thumbnail 
// example: https://thumbs.yiff.media/a51d55b12e7a16a37253783e52c4ec21.gif
```
