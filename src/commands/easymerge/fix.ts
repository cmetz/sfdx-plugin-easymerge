import { flags, FlagsConfig, SfdxCommand } from '@salesforce/command';
import { AnyJson } from '@salesforce/ts-types';
import * as fs from 'fs'
import * as glob from 'glob'
import * as xml2js from 'xml2js'


export default class Fix extends SfdxCommand {

    protected static flagsConfig: FlagsConfig = {
        sfdxsourcefolder: flags.string({ char: 'f', description: 'SFDX source folder' })
    };
    
    public async run(): Promise<AnyJson> {
        let argSfdxSourceFolder: string = this.flags.sfdxsourcefolder;
        const searchFolder = argSfdxSourceFolder + '/**/layouts/*.layout-meta.xml';
        const layoutsFileList = glob.sync(searchFolder);
        for (const layoutFile of layoutsFileList) {
            const parser = new xml2js.Parser();
            const builder = new xml2js.Builder({
                xmldec: {
                    'version': '1.0', 
                    'encoding': 'UTF-8'
                },
                renderOpts: {
                    'pretty': true,
                    'indent': '    ',
                    'newline': '\n'
                }
            });
            let inputXml = fs.readFileSync(layoutFile)
            let content = await parser.parseStringPromise(inputXml);
            // let content = parser.parseString(inputXml)
            if (content.Layout.platformActionList && content.Layout.platformActionList[0].platformActionListItems) {
                let items = content.Layout.platformActionList[0].platformActionListItems;
                if (items.length > 0) {
                    items.sort((a, b) => (a.actionName[0] > b.actionName[0]) ? 1 : ((b.actionName[0] > a.actionName[0]) ? -1 :0 ))
                }
                let xml = builder.buildObject(content);
                xml += '\n'
                if (xml !== inputXml.toString()) {
                    fs.writeFileSync(layoutFile, xml)
                    this.ux.log("Fixed layout: " + layoutFile)
                }
            }
        }

        return {  };
    };

}