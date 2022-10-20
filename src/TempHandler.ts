import exitHook from "async-exit-hook";
import { access, unlink } from "node:fs/promises";

export default class TempHandler {
    static list: Array<string> = [];
    static add(path: string) {
        this.list.push(path);
    }

    static async remove(...paths: Array<string>): Promise<void> {
        let path: string;
        if (paths.length === 1) {
            path = paths[0];
        } else {
            await Promise.all(paths.map(p => this.remove(p)));
            return;
        }
        if (this.list.includes(path)) {
            this.list.splice(this.list.indexOf(path), 1);
        }
        if (await access(path).then(() => true, () => false)) {
            await unlink(path);
        }
    }

    static async removeAll() {
        for (const entry of this.list) {
            await this.remove(entry);
        }
    }
}

exitHook(cb => TempHandler.removeAll().then(cb));
