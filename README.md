sfdx-plugin-easymerge
=====

[![Version](https://img.shields.io/npm/v/sfdx-plugin-easymerge.svg)](https://npmjs.org/package/sfdx-plugin-easymerge)
[![Greenkeeper](https://badges.greenkeeper.io/cmetz/sfdx-plugin-easymerge.svg)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/cmetz/sfdx-plugin-easymerge/badge.svg)](https://snyk.io/test/github/cmetz/sfdx-plugin-easymerge)
[![Downloads/week](https://img.shields.io/npm/dw/sfdx-plugin-easymerge.svg)](https://npmjs.org/package/sfdx-plugin-easymerge)
[![License](https://img.shields.io/npm/l/sfdx-plugin-easymerge.svg)](https://github.com/cmetz/sfdx-plugin-easymerge/blob/master/package.json)

SFDX plugin which reformats metadata for easier merge and conflict handling.

**Alpha release!**

It orders the plattformActionList by name on the layouts by hooking into sfdx retrieve.

It also allows you to configure nodes(tags) inside your xml-metadata which should not be pretty printed, by allowing them to be collapsed in a single line.

# Install

```sh-session
$ sfdx plugin:install sfdx-plugin-easymerge
```

# Configure collapsing

The collapsing can be configured in you sfdx-project.json.

Just add the complete XML-NodePath seperated by '.' the to the plugin configuration e.g.:

```
  "plugins": {
    "easymerge": {
      "collapseTags": [
        "Layout.layoutSections.layoutColumns.layoutItems",
        "Layout.platformActionList.platformActionListItems"
      ]
    }
  }
```

Like:

<img src=".images/collapseTagsConfigExample.png" width="800"><br>

The Result after your next retrieve should contain the configured XML-NodePathes to by collapsed:

<img src=".images/collapseTagsExample.png" width="800"><br>
