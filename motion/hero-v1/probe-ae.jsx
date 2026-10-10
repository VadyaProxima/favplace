(function () {
  var root = new Folder('C:/favplace/motion/hero-v1');
  var oldSecurity = app.preferences.getPrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY');
  app.preferences.savePrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY', 1);
  var log = new File(root.fsName + '/ae-probe.log');
  log.open('w');
  try {
    log.writeln('After Effects ' + app.version);
    log.writeln('Existing project items: ' + app.project.numItems);
    var comp = app.project.items.addComp('FAVPLACE_PROBE', 1920, 1080, 1, 10, 30);
    var solid = comp.layers.addSolid([.5,.5,.5], 'probe', 1920, 1080, 1);
    var names = ['ADBE Displacement Map', 'ADBE Glo2', 'ADBE Gaussian Blur 2', 'ADBE Shift Channels'];
    for (var n = 0; n < names.length; n++) {
      var effect = solid.property('ADBE Effect Parade').addProperty(names[n]);
      log.writeln(names[n]);
      for (var i = 1; i <= effect.numProperties; i++) {
        var p = effect.property(i);
        log.writeln(i + ' | ' + p.name + ' | ' + p.matchName);
      }
    }
    comp.remove();
    log.writeln('PROBE_OK');
  } catch (e) { log.writeln('ERROR ' + e.toString() + ' line ' + e.line); }
  log.close();
  app.preferences.savePrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY', oldSecurity);
})();
