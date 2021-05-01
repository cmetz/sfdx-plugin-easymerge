// It uses an adapted builder from https://www.npmjs.com/package/xml2js in order to use a custom writer
// Builder Author: Marek Kubica 
// Package - LICENSE: MIT


import { promises as fs } from 'fs';
import { parseString } from 'xml2js';
import { Command, Hook } from '@oclif/config';
import * as xmlbuilder from 'xmlbuilder'



type HookFunction = (this: Hook.Context, options: HookOptions) => any;

type HookOptions = {
  Command: Command.Class;
  argv: string[];
  commandId: string;
  result?: PostSourceUpdateResult;
};

type PostSourceUpdateResult = {
  [aggregateName: string]: {
    workspaceElements: workspaceElement[];
  };
};

type workspaceElement = {
    fullName:string;
    metadataName:string;
    filePath:string;
    state:string;
    deleteSupported:boolean;
    type:string;
};



export const hook: HookFunction = async function (options) {
  console.log('PostSourceUpdateResult Hook Running');

  // Run only on the pull command, not the retrieve command
  // if (options.commandId === 'force:source:pull') {
    if (options.result) {
        for (const k in options.result) {
            const result = options.result[k];
            for (const element of result.workspaceElements) {
                if (element.type === 'Layout') {
                    await collapseElement(element);
                }
            };
        };
    }
};

function requiresCDATA(entry: any): boolean {
    return typeof(entry) === "string" && (entry.indexOf('&') >= 0 || entry.indexOf('>') >= 0 || entry.indexOf('<') >= 0)
}


function wrapCDATA(entry: any): string {
    return "<![CDATA[" + escapeCDATA(entry.toString()) + "]]>"
}

function escapeCDATA(entry: string): string {
  return entry.replace(']]>', ']]]]><![CDATA[>')
}

async function collapseElement(element: workspaceElement) {

    const incomingXml = await fs.readFile(element.filePath, 'utf-8');
    const incomingJson = await new Promise<any>((resolve, reject) =>
        parseString(incomingXml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
        })
    );


    const render = (element: xmlbuilder.XMLElement, obj: any) => {
        if (typeof(obj) !== 'object') {
            if (requiresCDATA(obj)) {
                element.raw(wrapCDATA(obj))
            } else {
                element.txt(obj);
            }
        } else if (Array.isArray(obj)) {
            for (const child of Object.values(obj)) {
                for (const [key, entry] of Object.entries(child)) {
                    element = render(element.ele(key), entry).up();
                }
            }
        } else {
            for (const [key , child] of Object.entries(obj)) {
                if (key === '$') {
                    if (typeof(child) === "object") {
                        for ( const [attr, value] of Object.entries(child)) {
                            element = element.att(attr, value)
                        }
                    }
                } else if (key === '@') {
                    if (requiresCDATA(child)) {
                        element.raw(wrapCDATA(child))
                    } else {
                        element = element.txt(child.toString())
                    }
                } else if (Array.isArray(child)) {
                    for (const entry of Object.values(child)) {
                        if (typeof(entry) === 'string') {
                            if (requiresCDATA(entry)) {
                                element.ele(key).raw(wrapCDATA(entry)).up()
                            } else {
                                element = element.ele(key, entry).up()
                            }
                        } else {
                            element = render(element.ele(key), entry).up()
                        }
                    }
                } else if (typeof(child) === 'object') {
                    element = render(element.ele(key), child).up()
                } else {
                    if (requiresCDATA(child)) {
                        element = element.ele(key).raw(wrapCDATA(child)).up();
                    } else {
                        element = element.ele(key, child.toString()).up();
                    }
                }
            }
        };
        return element;
    }

    const rootName = Object.keys(incomingJson)[0]
    const rootObj = incomingJson[rootName]
    const rootElement = xmlbuilder.create(rootName, {'version': '1.0', 'encoding': 'UTF-8'});

    const newIndent = (node: xmlbuilder.XMLElement, options: xmlbuilder.WriterOptions, level: number): string => {
        if ((node.parent && node.parent.name === "platformActionListItems" && options.state === xmlbuilder.writerState.OpenTag) ||
        (node.name === "platformActionListItems" && options.state === xmlbuilder.writerState.CloseTag)) {
            return ''
        }
        return options.writer['_indent'](node, options, level);
    };

    const newEndLine = (node: xmlbuilder.XMLElement, options: xmlbuilder.WriterOptions, level: number): string => {
        if ((node.parent && node.parent.name === "platformActionListItems" && options.state === xmlbuilder.writerState.CloseTag) ||
        (node.name === "platformActionListItems" && options.state === xmlbuilder.writerState.OpenTag)) {
            return ''
        }
        return options.writer['_endline'](node, options, level);
    };

    const myWriter = xmlbuilder.stringWriter({writer: {indent: newIndent, endline: newEndLine}, newline: '\n', indent: '    ', pretty: true});
    
    const outputXml = render(rootElement, rootObj).end(myWriter);

    await fs.writeFile(element.filePath, outputXml + '\n', 'utf-8');
}