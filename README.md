# create-gnome-extension

`create-gnome-extension` is a community maintained scaffolding tool to build GNOME Shell extensions.

## Developing a GNOME Shell extension

To get started with developing GNOME Shell extensions, visit [gjs.guide](https://gjs.guide/extensions/). It has tutorials and guides written by the GNOME community.

If you need more help, you can use the following channels

-   [Discourse](https://discourse.gnome.org/tag/extensions)
-   [Matrix](https://matrix.to/#/#extensions:gnome.org)
-   [StackOverflow](https://stackoverflow.com/questions/tagged/gnome-shell-extensions+gjs)

## Usage

To use `create-gnome-extension` run the following command in a terminal.

```sh
npm create gnome-extension
```

## Project Structure

When running `npm create gnome-extension`, information about your project will be asked and the following file structure will be created. Depending on how you answered the questions, some files may not be included in your project.

```
project-directory/
├── data/
├── po/
├── scripts/
├── src/
│   ├── schemas/
│   │   └── org.gnome.shell.extensions.project-name.gschema.xml
│   ├── extension.json
│   ├── prefs.json
│   └── stylesheet.css
├── metadata.json
└── ...
```

-   `data/` contains files that will be bundled into a [GResource](https://docs.gtk.org/gio/struct.Resource.html) file when building your extension.
-   `po/` contains files for the [translation of your project](https://gjs.guide/extensions/development/translations.html). The template file (`*.pot`) lists all translatable strings. Translators will use this template to create translation files (`*.po`).
-   `scripts/` consists of bash scripts to build and install your extension.
-   `src/` is where the actual source code of your extension will reside. `extension.js` is the main entry point, `prefs.js` is the entry point for your preference window.
-   `metadata.json` provides information about your extension for GNOME Shell's extension system.

Other files may be included but they aren't directly related to extension development. For instance, configuration files for tools like Prettier or ESLint.

## License

This software is distributed under the terms of the GNU General Public License, version 2 or later. See the license file for details.
