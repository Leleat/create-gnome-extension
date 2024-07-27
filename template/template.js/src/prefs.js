import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class $PLACEHOLDER$ extends ExtensionPreferences {
    /**
     * Get the single widget that implements the extension's preferences.
     *
     * @returns {Promise<Gtk.Widget>} The widget that implements the extension's
     *      preferences.
     */
    async getPreferencesWidget() {
        // Alternetively, you can use the `fillPreferencesWindow` method for
        // more control over the preferences window. Only implement one of the
        // methods.
    }

    /**
     * Fill the preferences window.
     *
     * @param {Adw.Window} window
     *
     * @returns {Promise<void>}
     */
    // async fillPreferencesWindow(window) {
    //     The default implementation adds the widget returned by `getPreferencesWidget`.
    // }
}
