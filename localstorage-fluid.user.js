// Workaround for broken LocalStorage in FluidApp.
// LocalStorage survives page reload, but doesn't persist across runs of the app.
//
// Surprisingly, the (deprecated) WebDatabase storage _does_ survive, so we can
// use it for a workaround:
//
// 1. Periodically copy LocalStorage into a WebDatabase.
//    * For Pandora, we can hook jStorage (which Pandora uses for LocalStorage access)
//      to capture changes. For other apps, you'd need to do something different.
//    * (Note that window.onunload or even window.onbeforeunload seem, sadly,
//      unable to reliably write to the DB during app Quit.)
//
// 2. On launch, restore LocalStorage from the WebDatabase.
//    * Because our userscript runs _after_ all the other scripts on the page,
//      we must force a page reload after restoring LocalStorage. (The restored
//      LocalStorage will survive the reload, and so will be available to the
//      page's scripts the second time around.)
//    * We set a flag in LocalStorage to figure out if this userscript is
//      running during initial launch (flag won't be there, so must restore
//      LocalStorage), or during the page reload (flag set).
//
(function() {
    var dbName = "localstorage",
        dbMaxSize = 1024*1024;  // 1MB

    function dberror(tx, err) {
        console.log("*** DB error", err.message, err);
    }

    // Create the DB and localstorage table
    var db = openDatabase(dbName, "1", "LocalStorage persistence workaround", dbMaxSize);
    db.transaction(function(tx) {
        tx.executeSql("CREATE TABLE IF NOT EXISTS localstorage (k TEXT PRIMARY KEY ASC, v TEXT)",
            [], null, dberror);
    });

    function restoreLocalStorageFromDB(callback) {
        db.transaction(function(tx) {
            tx.executeSql("SELECT k, v FROM localstorage", [],
                function readSuccess(tx, result) {
                    for (var i=0; i < result.rows.length; i++) {
                        var row = result.rows.item(i);
                        localStorage[row.k] = row.v;
                    }
                    callback && callback();
                },
                dberror);
        });
    }

    function copyLocalStorageToDB() {
        db.transaction(function(tx) {
            var keys = Object.keys(localStorage);
            keys.forEach(function(key) {
                var value = localStorage[key];
                tx.executeSql("INSERT OR REPLACE INTO localstorage (k, v) VALUES (?,?)",
                    [key, value], null, dberror);
            });
            // Delete all DB keys not in localStorage
            var placeholders = keys.map(function(k) { return '?'; }).join(',');
            tx.executeSql("DELETE FROM localstorage WHERE k NOT IN (" + placeholders + ")",
                keys, null, dberror);
        });
    }


    if (!localStorage.restoredFromDB) {
        // First time after launch: restore localStorage.jStorage from DB and reload page.
        restoreLocalStorageFromDB(function() {
            localStorage.restoredFromDB = "done"; // flag to detect second time through
            document.location.reload();
        });
    } else {
        // After reload: copy localStorage to DB when it changes.
        // Pandora uses jStorage, so we can patch those functions.
        // For other apps, you'd need to change this to call copyLocalStorageToDB()
        // after changes (or on an interval, or...).
        ['set', 'deleteKey', 'setTTL', 'flush'].forEach(function(fnName) {
            var original = $.jStorage[fnName];
            if (original) {
                $.jStorage[fnName] = function() {
                    original.apply(this, arguments);
                    copyLocalStorageToDB();
                }
            }
        });
    }
})();
