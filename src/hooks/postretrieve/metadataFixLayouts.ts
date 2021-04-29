import { promises as fs } from 'fs';
import { Builder, parseString } from 'xml2js';
import { Command, Hook } from '@oclif/config';
import * as minimatch from 'minimatch'

type HookFunction = (this: Hook.Context, options: HookOptions) => any;

type HookOptions = {
  Command: Command.Class;
  argv: string[];
  commandId: string;
  result?: PostRetrieveResult;
};

type PostRetrieveResult = {
  [aggregateName: string]: {
    mdapiFilePath: string;
  };
};

export const hook: HookFunction = async function (options) {
  console.log('PostRetrieve Hook Running');

  // Run only on the pull command, not the retrieve command
  // if (options.commandId === 'force:source:pull') {
  if (options.result) {
    for (const mdapiElementName of Object.keys(options.result)) {
      console.log('Updating the ' + mdapiElementName + ' object');
      let mdapiElement = options.result![mdapiElementName]!;

      // Update the object locally so that the pull does not overwrite the local description
      await fixLayout(
        mdapiElementName,
        mdapiElement.mdapiFilePath[0]
      );
    }
  }
};
// };

export default hook;

async function fixLayout(objectName: string, objectPath: string) {
    if (!minimatch(objectPath, "/**/layouts/*.layout")) {
        return;
    }

    const incomingXml = await fs.readFile(objectPath, 'utf-8');
    const incomingJson = await new Promise<any>((resolve, reject) =>
        parseString(incomingXml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
        })
    );

    const builder = new Builder({
        xmldec: {
            'version': '1.0', 
            'encoding': 'UTF-8'
        }
        // ,
        // renderOpts: {
        //     'pretty': true,
        //     'indent': '    ',
        //     'newline': '\n'
        // }
    });

    if (incomingJson.Layout.platformActionList && incomingJson.Layout.platformActionList[0].platformActionListItems) {
        let items = incomingJson.Layout.platformActionList[0].platformActionListItems;
        if (items.length > 0) {
            items.sort((a: any, b: any) => (a.actionName[0] > b.actionName[0]) ? 1 : ((b.actionName[0] > a.actionName[0]) ? -1 :0 ))
        }
    }

    const xml = builder.buildObject(incomingJson);
    await fs.writeFile(objectPath, xml, 'utf-8');
}