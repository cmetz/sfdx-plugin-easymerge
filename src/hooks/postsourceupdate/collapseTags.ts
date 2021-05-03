// It uses an adapted builder from https://www.npmjs.com/package/xml2js in order to use a custom writer
// Builder Author: Marek Kubica 
// Package - LICENSE: MIT

import { Easymerge } from "../../easymerge";
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

    let pluginConfig = await Easymerge.getConfig();
    let collapseConfig = pluginConfig.collapseTags || [];
    let types: Array<string> = new Array<string>();
    let tags: Array<string> = new Array<string>();
    for (const tag of collapseConfig.values()) {
        const newType = tag.split('.')[0]
        if (!types.includes(newType)) {
            types.push(newType);
        }
        if (!tags.includes(tag)) {
            tags.push(tag);
        }
    }
    if (options.result) {
        for (const k in options.result) {
            const result = options.result[k];
            for (const element of result.workspaceElements) {
                if (types.includes(element.type)) {
                    await collapseElement(element, tags);
                }
            };
        };
    }
};

function requiresEscaping(entry: any): boolean {
    return typeof(entry) === "string" && (entry.indexOf('&') >= 0 || entry.indexOf('>') >= 0 || entry.indexOf('<') >= 0 || entry.indexOf('\'') >= 0 || entry.indexOf('"') >= 0)
}


function escapeText(entry: any): string {
    // first &
    return entry.toString().replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

async function collapseElement(element: workspaceElement, tags:Array<String>) {

    const incomingXml = await fs.readFile(element.filePath, 'utf-8');
    const incomingJson = await new Promise<any>((resolve, reject) =>
        parseString(incomingXml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
        })
    );


    const render = (element: xmlbuilder.XMLElement, obj: any) => {
        if (typeof(obj) !== 'object') {
            if (requiresEscaping(obj)) {
                element.raw(escapeText(obj))
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
                    if (requiresEscaping(child)) {
                        element.raw(escapeText(child))
                    } else {
                        element = element.txt(child.toString())
                    }
                } else if (Array.isArray(child)) {
                    for (const entry of Object.values(child)) {
                        if (typeof(entry) === 'string') {
                            if (requiresEscaping(entry)) {
                                element.ele(key).raw(escapeText(entry)).up()
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
                    if (requiresEscaping(child)) {
                        element = element.ele(key).raw(escapeText(child)).up();
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
        let nodePath = new Array<string>();
        let lastNode = node;
        while (lastNode) {
            if (lastNode.type === xmlbuilder.nodeType.Element && lastNode.name) {
                nodePath.unshift(lastNode.name);
            }
            lastNode = lastNode.parent
        }
        const parentNodePath = nodePath.slice(0, -1).join('.');
        const currentNodePath = nodePath.join('.');
        if ((tags.includes(parentNodePath) && options.state === xmlbuilder.writerState.OpenTag) ||
            (tags.includes(currentNodePath) && options.state === xmlbuilder.writerState.CloseTag)) {
            return ''
        }
        return options.writer['_indent'](node, options, level);
    };

    const newEndLine = (node: xmlbuilder.XMLElement, options: xmlbuilder.WriterOptions, level: number): string => {
        let nodePath = new Array<string>();
        let lastNode = node;
        while (lastNode) {
            if (lastNode.type === xmlbuilder.nodeType.Element && lastNode.name) {
                nodePath.unshift(lastNode.name);
            }
            lastNode = lastNode.parent
        }
        const parentNodePath = nodePath.slice(0, -1).join('.');
        const currentNodePath = nodePath.join('.');
        if ((tags.includes(parentNodePath) && options.state === xmlbuilder.writerState.CloseTag) ||
            (tags.includes(currentNodePath) && options.state === xmlbuilder.writerState.OpenTag)) {
            return ''
        }
        return options.writer['_endline'](node, options, level);
    };

    const myWriter = xmlbuilder.stringWriter({writer: {indent: newIndent, endline: newEndLine}, newline: '\n', indent: '    ', pretty: true});
    
    const outputXml = render(rootElement, rootObj).end(myWriter);

    await fs.writeFile(element.filePath, outputXml + '\n', 'utf-8');
}