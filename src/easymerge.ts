import { SfdxProject } from "@salesforce/core"

export class Easymerge {
    private static pluginConfig;

    public static async getConfig() {
        if (!Easymerge.pluginConfig) {
            const dxProject = await SfdxProject.resolve();
            const project = await dxProject.retrieveSfdxProjectJson();
            let plugins = project.get("plugins") || {};
            let easymergeConfig = plugins["easymerge"];
            Easymerge.pluginConfig = easymergeConfig || {};
        }
        return Easymerge.pluginConfig;
    }
}