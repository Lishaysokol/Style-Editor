figma.showUI(__html__, { width: 900, height: 780, themeColors: true });

var variableNameCache = {};
var densityStorageKey = 'stylesDensity';
var warningIndicatorStorageKey = 'stylesFolderWarningBadge';
var issuesCacheStorageKey = 'issuesCache-v1';

async function getDensityPreference() {
  try {
    var density = await figma.clientStorage.getAsync(densityStorageKey);
    if (density === 'compact' || density === 'default' || density === 'comfortable') return density;
  } catch (err) {}
  return null;
}

async function getFolderWarningIndicatorPreference() {
  try {
    var value = await figma.clientStorage.getAsync(warningIndicatorStorageKey);
    return value === true;
  } catch (err) {}
  return false;
}

async function getIssuesCache() {
  try {
    var cache = await figma.clientStorage.getAsync(issuesCacheStorageKey);
    return cache || null;
  } catch (err) {}
  return null;
}

async function setIssuesCache(cache) {
  try {
    await figma.clientStorage.setAsync(issuesCacheStorageKey, cache || null);
  } catch (err) {}
}

function rgbToHex(r, g, b) {
  var rHex = Math.round(r * 255).toString(16).padStart(2, '0');
  var gHex = Math.round(g * 255).toString(16).padStart(2, '0');
  var bHex = Math.round(b * 255).toString(16).padStart(2, '0');
  return '#' + rHex + gHex + bHex;
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0.5, g: 0.5, b: 0.5 };
}

function getPaintVariableAlias(paint, boundVars, paintIndex) {
  if (paint && paint.boundVariables && paint.boundVariables.color) {
    return paint.boundVariables.color;
  }
  if (boundVars && boundVars.paints && boundVars.paints[paintIndex] && boundVars.paints[paintIndex].color) {
    return boundVars.paints[paintIndex].color;
  }
  return null;
}

function getAliasVariableId(alias) {
  if (!alias) return null;
  if (typeof alias.id === 'string' && alias.id.length > 0) return alias.id;
  if (typeof alias.variableId === 'string' && alias.variableId.length > 0) return alias.variableId;
  if (Array.isArray(alias.variableIds) && alias.variableIds.length > 0) return alias.variableIds[0];
  return null;
}

function getAliasDisplayName(alias) {
  if (!alias) return null;
  return alias.name || alias.variableName || alias.aliasName || null;
}

async function getVariableNameById(varId) {
  if (!varId) return null;
  if (variableNameCache.hasOwnProperty(varId)) {
    return variableNameCache[varId];
  }
  try {
    var variable = await figma.variables.getVariableByIdAsync(varId);
    var name = variable ? variable.name : null;
    variableNameCache[varId] = name;
    return name;
  } catch (err) {
    variableNameCache[varId] = null;
    return null;
  }
}

function getGradientCSS(paint) {
  var stops = paint.gradientStops;
  var cssStops = [];
  for (var i = 0; i < stops.length; i++) {
    var stop = stops[i];
    var alpha = stop.color.a !== undefined ? stop.color.a : 1;
    var rgba = 'rgba(' + Math.round(stop.color.r * 255) + ',' + Math.round(stop.color.g * 255) + ',' + Math.round(stop.color.b * 255) + ',' + alpha + ')';
    cssStops.push(rgba + ' ' + Math.round(stop.position * 100) + '%');
  }
  if (paint.type === 'GRADIENT_LINEAR') return 'linear-gradient(90deg, ' + cssStops.join(', ') + ')';
  if (paint.type === 'GRADIENT_RADIAL') return 'radial-gradient(circle, ' + cssStops.join(', ') + ')';
  if (paint.type === 'GRADIENT_ANGULAR') return 'conic-gradient(' + cssStops.join(', ') + ')';
  return 'radial-gradient(circle, ' + cssStops.join(', ') + ')';
}

async function getAllColorStyles(knownVariableIds) {
  variableNameCache = {};
  var styles = await figma.getLocalPaintStylesAsync();
  var styleData = [];

  for (var s = 0; s < styles.length; s++) {
    var style = styles[s];
    var paintsData = [];
    var paints = style.paints;
    var boundVars = style.boundVariables;

    for (var p = 0; p < paints.length; p++) {
      var paint = paints[p];
      var paintInfo = {
        index: p,
        type: paint.type,
        visible: paint.visible !== false,
        opacity: paint.opacity !== undefined ? paint.opacity : 1,
        blendMode: paint.blendMode || 'NORMAL',
        hex: null,
        gradientCSS: null,
        variableId: null,
        variableName: null,
        variableStatus: null
      };

      if (paint.type === 'SOLID') {
        paintInfo.hex = rgbToHex(paint.color.r, paint.color.g, paint.color.b).toUpperCase();
        var varAlias = getPaintVariableAlias(paint, boundVars, p);
        if (varAlias) {
          var aliasId = getAliasVariableId(varAlias);
          var aliasName = getAliasDisplayName(varAlias);
          if (aliasId) {
            paintInfo.variableId = aliasId;
            var variableName = await getVariableNameById(aliasId);
            if (variableName) {
              paintInfo.variableName = variableName;
              if (knownVariableIds && !knownVariableIds[aliasId]) {
                paintInfo.variableStatus = 'missing';
              } else {
                paintInfo.variableStatus = 'linked';
              }
            } else {
              paintInfo.variableName = aliasName || 'Unknown Variable';
              paintInfo.variableStatus = 'missing';
            }
          } else {
            paintInfo.variableName = aliasName || 'Not linked';
            paintInfo.variableStatus = 'unlinked';
          }
        }
      } else if (paint.type.indexOf('GRADIENT') === 0) {
        paintInfo.gradientCSS = getGradientCSS(paint);
      }
      paintsData.push(paintInfo);
    }

    paintsData.reverse();
    styleData.push({ id: style.id, name: style.name, paints: paintsData });
  }

  styleData.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return styleData;
}

async function getAllColorVariables() {
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  var variables = [];

  for (var c = 0; c < collections.length; c++) {
    var collection = collections[c];
    for (var v = 0; v < collection.variableIds.length; v++) {
      var varId = collection.variableIds[v];
      try {
        var variable = await figma.variables.getVariableByIdAsync(varId);
        if (variable && variable.resolvedType === 'COLOR') {
          var modeId = collection.modes[0] ? collection.modes[0].modeId : null;
          var hex = null;
          if (modeId && variable.valuesByMode[modeId]) {
            var val = variable.valuesByMode[modeId];
            if (val && typeof val === 'object' && 'r' in val) {
              hex = rgbToHex(val.r, val.g, val.b).toUpperCase();
            }
          }
          variables.push({ id: variable.id, name: variable.name, collectionName: collection.name, hex: hex });
        }
      } catch (err) {}
    }
  }

  variables.sort(function(a, b) {
    var cmp = a.collectionName.localeCompare(b.collectionName);
    return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
  });
  return variables;
}

async function getVariableData() {
  var variables = await getAllColorVariables();
  var knownIds = {};
  for (var i = 0; i < variables.length; i++) {
    knownIds[variables[i].id] = true;
  }
  return { variables: variables, knownIds: knownIds };
}

async function saveStyleChanges(styleId, layerChanges) {
  try {
    var style = await figma.getStyleByIdAsync(styleId);
    if (!style || style.type !== 'PAINT') {
      return { success: false, error: 'Style not found' };
    }

    var currentPaints = style.paints.slice();
    var newPaints = [];

    // Process layer changes: reorder, add, delete, modify
    for (var i = 0; i < layerChanges.length; i++) {
      var change = layerChanges[i];
      
      if (change.action === 'keep' || change.action === 'modify') {
        var paint = currentPaints[change.originalIndex];
        if (!paint) continue;

        if (change.action === 'modify' && paint.type === 'SOLID') {
          var paintCopy = JSON.parse(JSON.stringify(paint));
          
          // Update hex color if changed
          if (change.hex) {
            var rgb = hexToRgb(change.hex);
            paintCopy.color = { r: rgb.r, g: rgb.g, b: rgb.b };
          }
          
          // Update opacity if changed
          if (change.opacity !== undefined) {
            paintCopy.opacity = change.opacity;
          }

          // Handle variable binding
          if (change.variableId) {
            var variable = await figma.variables.getVariableByIdAsync(change.variableId);
            if (variable) {
              paintCopy = figma.variables.setBoundVariableForPaint(paintCopy, 'color', variable);
            }
          } else if (change.unlinkVariable) {
            // Create new paint without variable binding
            paintCopy = {
              type: 'SOLID',
              color: paintCopy.color,
              opacity: paintCopy.opacity !== undefined ? paintCopy.opacity : 1,
              visible: paintCopy.visible !== undefined ? paintCopy.visible : true,
              blendMode: paintCopy.blendMode || 'NORMAL'
            };
          }
          newPaints.push(paintCopy);
        } else {
          newPaints.push(paint);
        }
      } else if (change.action === 'add') {
        var rgb = hexToRgb(change.hex || '#808080');
        var newPaint = {
          type: 'SOLID',
          color: { r: rgb.r, g: rgb.g, b: rgb.b },
          opacity: change.opacity !== undefined ? change.opacity : 1,
          visible: true,
          blendMode: 'NORMAL'
        };
        
        if (change.variableId) {
          var variable = await figma.variables.getVariableByIdAsync(change.variableId);
          if (variable) {
            newPaint = figma.variables.setBoundVariableForPaint(newPaint, 'color', variable);
          }
        }
        newPaints.push(newPaint);
      }
      // 'delete' action: simply don't add to newPaints
    }

    style.paints = newPaints;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}

async function init() {
  var varData = await getVariableData();
  var styles = await getAllColorStyles(varData.knownIds);
  var density = await getDensityPreference();
  var warningPreference = await getFolderWarningIndicatorPreference();
  var issuesCache = await getIssuesCache();
  figma.ui.postMessage({ type: 'init', styles: styles, variables: varData.variables, density: density, folderWarningBadgeEnabled: warningPreference, issuesCache: issuesCache });
}

figma.ui.onmessage = async function(msg) {
  if (msg.type === 'save-changes') {
    var result = await saveStyleChanges(msg.styleId, msg.layerChanges);
    if (result.success) {
      var varData = await getVariableData();
      var styles = await getAllColorStyles(varData.knownIds);
      figma.ui.postMessage({ type: 'styles-updated', styles: styles, savedStyleIds: [msg.styleId] });
      figma.notify('Style updated successfully');
    } else {
      figma.notify('Error: ' + result.error, { error: true });
    }
  } else if (msg.type === 'save-multiple') {
    var savedIds = [];
    var failed = [];
    var stylesToSave = Array.isArray(msg.styles) ? msg.styles : [];
    for (var i = 0; i < stylesToSave.length; i++) {
      var styleItem = stylesToSave[i];
      var multiResult = await saveStyleChanges(styleItem.styleId, styleItem.layerChanges);
      if (multiResult.success) {
        savedIds.push(styleItem.styleId);
      } else {
        failed.push({ styleId: styleItem.styleId, error: multiResult.error });
      }
    }
    var varData = await getVariableData();
    var styles = await getAllColorStyles(varData.knownIds);
    figma.ui.postMessage({ type: 'styles-updated', styles: styles, savedStyleIds: savedIds });
    if (failed.length === 0) {
      figma.notify('Styles updated successfully');
    } else {
      var errorMessage = failed[0].error || 'Unknown error';
      figma.notify('Some styles failed: ' + errorMessage, { error: true });
    }
  } else if (msg.type === 'refresh') {
    await init();
  } else if (msg.type === 'set-density') {
    if (msg.density === 'compact' || msg.density === 'default' || msg.density === 'comfortable') {
      await figma.clientStorage.setAsync(densityStorageKey, msg.density);
    }
  } else if (msg.type === 'set-folder-warning-indicator') {
    if (typeof msg.enabled === 'boolean') {
      await figma.clientStorage.setAsync(warningIndicatorStorageKey, msg.enabled);
    }
  } else if (msg.type === 'set-issues-cache') {
    await setIssuesCache(msg.cache);
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

init();
