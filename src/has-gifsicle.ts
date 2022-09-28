import { access } from "fs/promises";
import { delimiter } from "path";

export default async function hasGifsicle() {
    const envPath = process.env.PATH || "";
    const envExt = process.env.PATHEXT || "";
    const paths = envPath.replace(/["]+/g, "").split(delimiter).map(p => envExt.split(delimiter).map(e => `${p}/gifsicle${e}`)).reduce((a, b) => a.concat(b), []);
    for (const path of paths) {
        if (await access(path).then(() => true, () => false)) return true;
    }

    return false;
}
