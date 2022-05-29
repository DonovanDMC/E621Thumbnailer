declare module "simple-thumbnail" {
	import type { WriteStream } from "fs";
	interface Config {
		path?: string;
		seek?: string;
		args?: Array<string>;
	}
	function run(url: string, out: string | WriteStream, size: `${number}x${number}` | `${number}x?` | `?x${number}` | `${number}%`, config?: Config): Promise<void>;
	export = run;
}
