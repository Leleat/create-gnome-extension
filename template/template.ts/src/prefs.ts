import type Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class $PLACEHOLDER$ extends ExtensionPreferences {
    /**
     * Get the single widget that implements the extension's preferences.
     *
     * @returns The widget that implements the extension's preferences.
     */
    async getPreferencesWidget(): Promise<Gtk.Widget> {
        // Alternetively, you can use the `fillPreferencesWindow` method for
        // more control over the preferences window. Only implement one of the
        // methods.
    }

    /**
     * Fill the preferences window.
     *
     * @param window - The preferences window to fill.
     */
    // async fillPreferencesWindow(window: Adw.Window): Promise<void> {
    //     The default implementation adds the widget returned by `getPreferencesWidget`.
    // }
}
