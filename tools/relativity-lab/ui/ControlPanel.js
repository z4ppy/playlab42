/**
 * ControlPanel.js - Panneau de contrôle avec lil-gui
 *
 * Permet de contrôler la simulation :
 * - Play/Pause, Reset
 * - Vitesse de simulation
 * - Changement de référentiel
 * - Ajout/modification d'observateurs
 * - Options de visualisation (signaux, photons, par source)
 */

import GUI from 'lil-gui';
import * as THREE from 'three';

/**
 * Crée et configure le panneau de contrôle
 * @param {Simulation} simulation - Instance de simulation
 * @param {SceneManager} sceneManager - Gestionnaire de scène
 * @param {Function} onPlayToggle - Callback pour mise à jour UI externe
 * @returns {GUI}
 */
export function createControlPanel(simulation, sceneManager, onPlayToggle = () => {}) {
  const gui = new GUI({ title: '⚙️ Contrôles' });

  // Objet pour stocker les valeurs des contrôles
  const params = {
    // Simulation
    playing: false,
    timeScale: simulation.timeScale,
    autoEmitPhotons: simulation.autoEmitPhotons,

    // Référentiel
    referenceFrame: 'lab',

    // Visualisation (signaux cachés par défaut)
    showSignals: simulation.showSignals,  // false par défaut
    showAllSources: simulation.showAllSources,
    showGrid: true,
    showAxes: true,

    // Nouvel observateur
    newObsName: 'Obs-' + (simulation.observers.length + 1),
    newObsPosX: 5,
    newObsPosY: 0,
    newObsPosZ: 0,
    newObsVelX: 0.3,
    newObsVelY: 0,
    newObsVelZ: 0,
  };

  // === Dossier Simulation ===
  const simFolder = gui.addFolder('Simulation');

  simFolder.add(params, 'playing')
    .name('▶ Play / ⏸ Pause')
    .onChange(value => {
      if (value) {
        simulation.play();
      } else {
        simulation.pause();
      }
      onPlayToggle(value);
    });

  simFolder.add(params, 'timeScale', 0.1, 100, 0.1)
    .name('Vitesse')
    .onChange(value => {
      simulation.timeScale = value;
    });

  simFolder.add(params, 'autoEmitPhotons')
    .name('Émettre auto')
    .onChange(value => {
      simulation.autoEmitPhotons = value;
    });

  // Distance max des signaux (en log10 pour gérer les grandes valeurs)
  const distanceParams = { maxDistLog: Math.log10(simulation.maxSignalRadius) };
  simFolder.add(distanceParams, 'maxDistLog', 2, 12, 0.5)
    .name('Dist. max (10^x)')
    .onChange(value => {
      simulation.maxSignalRadius = Math.pow(10, value);
    });

  simFolder.add({
    reset: () => {
      simulation.reset();
      params.playing = false;
      onPlayToggle(false);
      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
  }, 'reset').name('↺ Reset');

  // === Dossier Visualisation ===
  const vizFolder = gui.addFolder('Visualisation');

  vizFolder.add(params, 'showSignals')
    .name('Signaux (sphères)')
    .onChange(value => {
      simulation.showSignals = value;
      simulation.signals.forEach(s => s.mesh.visible = value && (simulation.showAllSources || simulation.visibleSources.has(s.sourceId)));
    });

  vizFolder.add(params, 'showAllSources')
    .name('Toutes sources')
    .onChange(value => {
      simulation.showAllSources = value;
      // Rafraîchir la visibilité des signaux
      simulation.signals.forEach(s => s.mesh.visible = simulation.showSignals && (value || simulation.visibleSources.has(s.sourceId)));
      // Afficher/masquer le dossier des sources
      sourcesFolder.show(!value);
    });

  vizFolder.add(params, 'showGrid')
    .name('Grille')
    .onChange(value => {
      sceneManager.setGridVisible(value);
    });

  vizFolder.add(params, 'showAxes')
    .name('Axes')
    .onChange(value => {
      sceneManager.setAxesVisible(value);
    });

  // === Dossier Sources (filtrage par émetteur) ===
  const sourcesFolder = vizFolder.addFolder('Filtrer sources');
  sourcesFolder.close();

  function buildSourcesControls() {
    // Vider le dossier
    while (sourcesFolder.children.length > 0) {
      sourcesFolder.children[0].destroy();
    }

    for (const observer of simulation.observers) {
      const sourceParams = {
        visible: simulation.visibleSources.has(observer.id),
      };

      sourcesFolder.add(sourceParams, 'visible')
        .name(observer.name)
        .onChange(value => {
          simulation.setSourceVisibility(observer.id, value);
        });
    }
  }

  buildSourcesControls();

  // === Dossier Référentiel ===
  const frameFolder = gui.addFolder('Référentiel');

  const frameController = frameFolder.add(params, 'referenceFrame', buildFrameOptions(simulation))
    .name('Point de vue')
    .onChange(value => {
      simulation.setReferenceFrame(value);
      // Centrer la caméra sur le nouvel observateur
      const observer = simulation.getObserver(value);
      if (observer && sceneManager) {
        sceneManager.setTarget(observer.position);
      }
    });

  function updateFrameOptions() {
    const options = buildFrameOptions(simulation);
    frameController.options(options);
  }

  // === Dossier Ajouter Observateur ===
  const addFolder = gui.addFolder('Ajouter observateur');
  addFolder.close();

  addFolder.add(params, 'newObsName').name('Nom');

  const posFolder = addFolder.addFolder('Position');
  posFolder.add(params, 'newObsPosX', -10, 10, 0.5).name('X');
  posFolder.add(params, 'newObsPosY', -10, 10, 0.5).name('Y');
  posFolder.add(params, 'newObsPosZ', -10, 10, 0.5).name('Z');

  const velFolder = addFolder.addFolder('Vitesse (× c)');
  velFolder.add(params, 'newObsVelX', -0.95, 0.95, 0.05).name('Vx');
  velFolder.add(params, 'newObsVelY', -0.95, 0.95, 0.05).name('Vy');
  velFolder.add(params, 'newObsVelZ', -0.95, 0.95, 0.05).name('Vz');

  addFolder.add({
    add: () => {
      const position = new THREE.Vector3(
        params.newObsPosX,
        params.newObsPosY,
        params.newObsPosZ
      );
      const velocity = new THREE.Vector3(
        params.newObsVelX,
        params.newObsVelY,
        params.newObsVelZ
      );

      if (velocity.length() >= 1) {
        velocity.normalize().multiplyScalar(0.95);
        console.warn('Vitesse limitée à 0.95c');
      }

      simulation.addObserver(params.newObsName, position, velocity);

      params.newObsName = 'Obs-' + (simulation.observers.length + 1);
      params.newObsPosX += 2;

      updateFrameOptions();
      buildSourcesControls();
      buildObserverControls();

      gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
  }, 'add').name('➕ Ajouter');

  // === Dossier Observateurs existants ===
  const obsFolder = gui.addFolder('Observateurs');

  function buildObserverControls() {
    while (obsFolder.children.length > 0) {
      obsFolder.children[0].destroy();
    }

    for (const observer of simulation.observers) {
      const obsSubFolder = obsFolder.addFolder(observer.name);
      obsSubFolder.close();

      const velObj = {
        vx: observer.velocity.x,
        vy: observer.velocity.y,
        vz: observer.velocity.z,
      };

      obsSubFolder.add(velObj, 'vx', -0.95, 0.95, 0.05)
        .name('Vx')
        .onChange(value => {
          observer.velocity.x = value;
          observer.velocityCMB.x = value;
          observer.initialVelocity.x = value;
        });

      obsSubFolder.add(velObj, 'vy', -0.95, 0.95, 0.05)
        .name('Vy')
        .onChange(value => {
          observer.velocity.y = value;
          observer.velocityCMB.y = value;
          observer.initialVelocity.y = value;
        });

      obsSubFolder.add(velObj, 'vz', -0.95, 0.95, 0.05)
        .name('Vz')
        .onChange(value => {
          observer.velocity.z = value;
          observer.velocityCMB.z = value;
          observer.initialVelocity.z = value;
        });

      // Pas de suppression pour Lab
      if (observer.id !== 'lab' && simulation.observers.length > 2) {
        obsSubFolder.add({
          remove: () => {
            simulation.removeObserver(observer.id);
            updateFrameOptions();
            buildSourcesControls();
            buildObserverControls();
          }
        }, 'remove').name('🗑️ Supprimer');
      }
    }
  }

  buildObserverControls();

  // Exposer méthodes utilitaires
  gui.updateFrameOptions = updateFrameOptions;
  gui.rebuildObserverControls = buildObserverControls;
  gui.rebuildSourcesControls = buildSourcesControls;

  // Synchroniser l'état playing
  simulation.onUpdate(() => {
    if (params.playing !== (simulation.state === 'running')) {
      params.playing = simulation.state === 'running';
      gui.controllersRecursive().forEach(c => {
        if (c.property === 'playing') c.updateDisplay();
      });
      onPlayToggle(params.playing);
    }
  });

  return gui;
}

/**
 * Construit les options de référentiel
 * @param {Simulation} simulation
 * @returns {object}
 */
function buildFrameOptions(simulation) {
  const options = {};
  for (const observer of simulation.observers) {
    options[observer.name] = observer.id;
  }
  return options;
}
