import { access } from "node:fs/promises";
import { delimiter } from "node:path";

export default async function hasGifsicle() {
    const envPath = process.env.PATH || "";
    const envExt = process.env.PATHEXT || "";
    const paths = envPath.replace(/"+/g, "").split(delimiter).flatMap(p => envExt.split(delimiter).map(e => `${p}/gifsicle${e}`));
    for (const path of paths) {
        if (await access(path).then(() => true, () => false)) {
            return true;
        }
    }

    return false;
}
