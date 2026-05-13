import { tmpdir } from "node:os";

import pkg from "../package.json" with { type: "json" };

export const VERSION = pkg.version;
export const USER_AGENT = `E621Thumbnailer/${VERSION} (https://github.com/DonovanDMC/E621Thumbnailer)`;
export const TEMP_DIR = `${tmpdir()}/e621-thumbnailer`;
