(function () {
  var root = new Folder('C:/favplace/motion/hero-v1');
  var previous = app.preferences.getPrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY');
  app.preferences.savePrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY', 1);
  var log = new File(root.fsName + '/ae-build.log'); log.open('w');
  app.beginSuppressDialogs();
  try {
    // Running in the task's own AE instance. Preserve any existing project before creating this one.
    if (app.project.numItems > 0) {
      if (app.project.file) app.project.save();
      else app.project.save(new File(root.fsName + '/before-favplace.aep'));
    }
    app.newProject();
    app.project.bitsPerChannel = 16;
    var sources = app.project.items.addFolder('01 · 3D render passes');
    var compositions = app.project.items.addFolder('02 · Compositions');
    function sequence(name) {
      var first = new File(root.fsName + '/frames/' + name + '/frame_00000.png');
      if (!first.exists) throw new Error('Missing sequence: ' + first.fsName);
      var options = new ImportOptions(first); options.sequence = true; options.forceAlphabetical = true;
      var footage = app.project.importFile(options);
      footage.name = name.toUpperCase() + ' · Elbrus / 30 fps';
      footage.parentFolder = sources;
      footage.mainSource.conformFrameRate = 30;
      return footage;
    }
    var beauty = sequence('beauty'), depth = sequence('depth'), scan = sequence('scan'), warp = sequence('warp');
    var comp = app.project.items.addComp('FAVPLACE · HERO · 1920x1080 · 10s', 1920, 1080, 1, 10, 30);
    comp.parentFolder = compositions; comp.bgColor = [.956,.953,.941];
    comp.comment = 'Real Elbrus terrain, continuous alignment with the accepted Favplace ring. 3D sources: motion/hero-v1/scene.mjs. Native AE displacement, scan glow, chromatic split and shake are editable.';
    var depthLayer = comp.layers.add(depth); depthLayer.name = 'DEPTH · camera distance'; depthLayer.enabled = false; depthLayer.shy = true;
    var warpLayer = comp.layers.add(warp); warpLayer.name = 'WARP FIELD · depth wave'; warpLayer.enabled = false; warpLayer.shy = true;
    var base = comp.layers.add(beauty); base.name = 'MOUNTAIN → METAL · beauty';
    var displacement = base.property('ADBE Effect Parade').addProperty('ADBE Displacement Map');
    displacement.name = 'Power warp · depth guided';
    displacement.property(1).setValue(warpLayer.index);
    displacement.property(2).setValue(1); // red
    displacement.property(4).setValue(2); // green
    displacement.property(3).expression = "thisComp.layer('CONTROLS').effect('Power warp (px)')(1)";
    displacement.property(5).expression = "thisComp.layer('CONTROLS').effect('Power warp (px)')(1)*.55";
    displacement.property(7).setValue(1);
    var pulse = "function s(a,b,t){var x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*x*(x*(x*6-15)+10);} var p=s(3.65,5.55,time)*(1-s(8.25,10,time));var pulse=Math.pow(Math.sin(Math.PI*p),2);";
    base.property('ADBE Transform Group').property('ADBE Position').expression = pulse + "var a=thisComp.layer('CONTROLS').effect('Micro shake (px)')(1); value+[Math.sin(time*29)*pulse*a,Math.cos(time*23)*pulse*a*.6];";
    function aberration(name, channel, direction) {
      var layer = comp.layers.add(beauty); layer.name = name;
      var shift = layer.property('ADBE Effect Parade').addProperty('ADBE Shift Channels');
      shift.property(2).setValue(channel === 'red' ? 1 : 10);
      shift.property(3).setValue(10);
      shift.property(4).setValue(channel === 'blue' ? 3 : 10);
      layer.blendingMode = BlendingMode.ADD;
      layer.property('ADBE Transform Group').property('ADBE Position').expression = pulse + "var split=thisComp.layer('CONTROLS').effect('Chromatic split (px)')(1)*pulse;value+[split*" + direction + ",0];";
      layer.property('ADBE Transform Group').property('ADBE Opacity').expression = pulse + "thisComp.layer('CONTROLS').effect('Chromatic intensity (%)')(1)*pulse";
      var matte = comp.layers.add(scan); matte.name = name + ' · scan matte'; matte.shy = true;
      layer.trackMatteType = TrackMatteType.LUMA;
    }
    aberration('CA · RED', 'red', 1);
    aberration('CA · BLUE', 'blue', -1);
    var beam = comp.layers.add(scan); beam.name = 'SCAN · surface contour'; beam.blendingMode = BlendingMode.SCREEN;
    beam.property('ADBE Transform Group').property('ADBE Opacity').expression = "thisComp.layer('CONTROLS').effect('Scan intensity (%)')(1)";
    var glow = beam.property('ADBE Effect Parade').addProperty('ADBE Glo2'); glow.name = 'Scan halo';
    glow.property(2).setValue(24);
    glow.property(3).expression = "thisComp.layer('CONTROLS').effect('Glow radius (px)')(1)";
    glow.property(4).setValue(.85);
    var controller = comp.layers.addNull(10); controller.name = 'CONTROLS'; controller.label = 9;
    function slider(name, value) { var fx = controller.property('ADBE Effect Parade').addProperty('ADBE Slider Control'); fx.name = name; fx.property(1).setValue(value); }
    slider('Power warp (px)', 11);
    slider('Scan intensity (%)', 55);
    slider('Glow radius (px)', 22);
    slider('Chromatic split (px)', 1.6);
    slider('Chromatic intensity (%)', 28);
    slider('Micro shake (px)', .65);
    // Re-assign layer control after insertion so it points to the final layer index.
    base.property('ADBE Effect Parade').property('Power warp · depth guided').property(1).setValue(warpLayer.index);
    var cues = [[0,'01 / ELBRUS'],[1.6,'02 / SCALE & ALIGN'],[3.65,'03 / DEPTH SCAN'],[5.55,'04 / METAL'],[8.25,'05 / LOOP RETURN']];
    for (var i=0;i<cues.length;i++) comp.markerProperty.setValueAtTime(cues[i][0],new MarkerValue(cues[i][1]));
    comp.hideShyLayers = true;
    var output = new Folder(root.fsName + '/ae-render'); output.create();
    var item = app.project.renderQueue.items.add(comp);
    item.applyTemplate('Best Settings');
    var om = item.outputModule(1);
    log.writeln('Output templates: ' + om.templates.join(' | '));
    var png = false;
    for (var t=0;t<om.templates.length;t++) if (om.templates[t] === 'PNG Sequence') { om.applyTemplate('PNG Sequence'); png = true; break; }
    if (!png) om.applyTemplate('Lossless');
    om.file = new File(output.fsName + (png ? '/hero_[#####].png' : '/favplace-hero-master.avi'));
    app.project.save(new File(root.fsName + '/Favplace-Hero-v1.aep'));
    comp.time = 4.65;
    comp.saveFrameToPng(4.65, new File(root.fsName + '/ae-transition.png'));
    comp.saveFrameToPng(6.3, new File(root.fsName + '/ae-final.png'));
    comp.openInViewer();
    log.writeln('BUILD_OK');
    log.writeln('Project: ' + app.project.file.fsName);
    log.writeln('Output: ' + om.file.fsName);
    for (var l=1;l<=comp.numLayers;l++) {
      var effects=comp.layer(l).property('ADBE Effect Parade');
      for (var e=1;e<=effects.numProperties;e++) for(var p=1;p<=effects.property(e).numProperties;p++) {
        var prop=effects.property(e).property(p);
        if(prop.canSetExpression && prop.expressionError) log.writeln('EXPRESSION_ERROR ' + comp.layer(l).name + ' ' + prop.expressionError);
      }
    }
  } catch(error) { log.writeln('ERROR: ' + error.toString() + ' line ' + error.line); }
  app.endSuppressDialogs(false);
  log.close();
  app.preferences.savePrefAsLong('Main Pref Section', 'Pref_SCRIPTING_FILE_NETWORK_SECURITY', previous);
})();
