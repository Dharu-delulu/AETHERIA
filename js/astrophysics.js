/**
 * SUPERNOVA LAB - Astrophysics Engine
 * Real-time stellar evolution, fusion shell modeling, core collapse physics,
 * remnant prediction, nucleosynthesis yield, and light curve generation.
 */

class AstrophysicsEngine {
  /**
   * Determine stellar properties based on initial parameters
   * @param {Object} params { mass, temperature, age, rotation, metallicity, composition, isBinary, companionMass, companionDistance }
   */
  static analyzeStar(params) {
    const mass = Math.max(0.5, Math.min(300, parseFloat(params.mass) || 20));
    const rotation = Math.max(0, Math.min(100, parseFloat(params.rotation) || 0)); // % of breakup speed
    const metallicity = Math.max(0.001, Math.min(5, parseFloat(params.metallicity) || 1)); // relative to Z_sun
    const tempOverride = params.temperature ? parseFloat(params.temperature) : null;
    const isBinary = !!params.isBinary;
    const companionMass = isBinary ? parseFloat(params.companionMass || 1.4) : 0;

    // Mass-Luminosity relation (L in Solar Luminosities)
    let luminosity;
    if (mass < 0.43) {
      luminosity = 0.23 * Math.pow(mass, 2.3);
    } else if (mass < 2) {
      luminosity = Math.pow(mass, 4.0);
    } else if (mass < 55) {
      luminosity = 1.4 * Math.pow(mass, 3.5);
    } else {
      luminosity = 32000 * mass;
    }

    // Main sequence lifetime (t_life in Millions of Years)
    const lifespanMyr = Math.round(10000 * (mass / Math.pow(luminosity, 0.9)) * 10) / 10;
    const effectiveLifespan = Math.max(2.5, Math.min(12000, lifespanMyr));

    // Temperature (K)
    let temperature = tempOverride;
    if (!temperature) {
      // Standard Mass-Temperature relation for main sequence / supergiants
      if (mass > 40) temperature = 38000 + (mass - 40) * 200;
      else if (mass > 20) temperature = 28000 + (mass - 20) * 500;
      else if (mass > 8) temperature = 15000 + (mass - 8) * 1600;
      else temperature = 5778 * Math.pow(mass, 0.5);
    }

    // Radius (Solar Radii R_sun)
    const radius = Math.sqrt(luminosity) * Math.pow(5778 / temperature, 2);

    // Spectral Class
    const spectralClass = this.getSpectralClass(temperature, mass, radius);

    // Determine Core Collapse & Supernova Pathway
    const fate = this.predictSupernovaFate({ mass, rotation, metallicity, isBinary, companionMass });

    // Calculate Nuclear Fusion Shell Structure
    const coreShells = this.generateFusionShells(mass, fate.type);

    // Calculate Nucleosynthesis (Ejected Element Yields in Solar Masses)
    const nucleosynthesis = this.calculateNucleosynthesis(mass, fate.type);

    // Explosion Energy (in Bethes / 10^51 ergs)
    let explosionEnergyBethes = 1.0;
    if (fate.type === 'Type Ia') explosionEnergyBethes = 1.3;
    else if (fate.type === 'Pair-Instability Supernova') explosionEnergyBethes = 10.0 + (mass - 130) * 0.5;
    else if (fate.type === 'Hypernova / GRB') explosionEnergyBethes = 10.0 + (rotation / 10) * 2.0;
    else if (fate.type === 'Electron-Capture Supernova') explosionEnergyBethes = 0.3;
    else if (fate.type === 'Failed Supernova (Direct Collapse)') explosionEnergyBethes = 0.05;
    else explosionEnergyBethes = 1.0 + Math.min(3.0, (mass - 10) * 0.08);

    // Ejecta Mass & Expansion Velocity
    const remnantMass = fate.remnantMass;
    const ejectaMass = Math.max(0, mass - remnantMass);
    // v = sqrt(2E/m) -> scaled to km/s
    const ejectaVelocityKms = ejectaMass > 0 
      ? Math.round(Math.sqrt((2 * explosionEnergyBethes * 1e51 * 1e-7) / (ejectaMass * 1.989e30)) / 100) * 10
      : 0;

    // Light curve points
    const lightCurve = this.generateLightCurve(fate.type, explosionEnergyBethes, ejectaMass);

    return {
      mass,
      luminosity: Math.round(luminosity),
      radius: Math.round(radius * 10) / 10,
      temperature: Math.round(temperature),
      spectralClass,
      lifespanMyr: effectiveLifespan,
      rotation,
      metallicity,
      isBinary,
      companionMass,
      fate,
      coreShells,
      nucleosynthesis,
      explosionEnergyBethes: Math.round(explosionEnergyBethes * 10) / 10,
      ejectaMass: Math.round(ejectaMass * 10) / 10,
      remnantMass: Math.round(remnantMass * 10) / 10,
      ejectaVelocityKms: Math.max(3000, Math.min(35000, ejectaVelocityKms || 12000)),
      lightCurve
    };
  }

  /**
   * Determine Spectral Class String
   */
  static getSpectralClass(temp, mass, radius) {
    if (mass > 30 && radius > 100) return 'Red Supergiant (M-type)';
    if (mass > 25 && temp > 30000 && radius < 15) return 'Wolf-Rayet Star (WR)';
    if (temp >= 30000) return 'O-type Blue Giant';
    if (temp >= 10000) return 'B-type Blue Star';
    if (temp >= 7500) return 'A-type White Star';
    if (temp >= 6000) return 'F-type Yellow-White Star';
    if (temp >= 5200) return 'G-type Yellow Dwarf (Sun-like)';
    if (temp >= 3700) return 'K-type Orange Dwarf';
    return 'M-type Red Dwarf / Red Giant';
  }

  /**
   * Predict Supernova Fate & Remnant
   */
  static predictSupernovaFate({ mass, rotation, metallicity, isBinary, companionMass }) {
    // Type Ia scenario: Binary system with mass transfer onto White Dwarf
    if (isBinary && mass < 8 && companionMass >= 1.0) {
      return {
        type: 'Type Ia Thermonuclear Supernova',
        category: 'Thermonuclear Detonation',
        remnant: 'No Central Remnant (Complete Thermonuclear Disruption)',
        remnantType: 'none',
        remnantMass: 0,
        badge: '💥 TYPE Ia SUPERNOVA',
        description: 'A white dwarf accretes material from its binary companion until reaching the Chandrasekhar limit (1.4 M☉). Carbon fusion ignites explosively throughout the star, completely disrupting it with no central remnant.'
      };
    }

    // Low mass: No Supernova
    if (mass < 8.0) {
      const wdMass = Math.min(1.4, 0.5 + mass * 0.1);
      return {
        type: 'Planetary Nebula & White Dwarf',
        category: 'Non-Explosive End',
        remnant: `Carbon-Oxygen White Dwarf (${wdMass.toFixed(2)} M☉)`,
        remnantType: 'whitedwarf',
        remnantMass: wdMass,
        badge: '🌌 PLANETARY NEBULA',
        description: 'Star gently sheds its outer envelope, forming a glowing planetary nebula around a dense, cooling White Dwarf.'
      };
    }

    // 8 - 10 Solar Masses: Electron Capture Supernova
    if (mass >= 8.0 && mass < 10.0) {
      return {
        type: 'Electron-Capture Supernova',
        category: 'Low-Mass Core Collapse',
        remnant: 'Neutron Star (1.25 M☉)',
        remnantType: 'neutronstar',
        remnantMass: 1.25,
        badge: '⚡ ELECTRON CAPTURE SN',
        description: 'Electron capture onto Magnesium & Neon in the degenerate core triggers core collapse, producing a faint supernova and a low-mass Neutron Star.'
      };
    }

    // High rotation (>70%) and High Mass (>30 M): Hypernova / GRB
    if (mass >= 30.0 && rotation >= 70) {
      const bhMass = Math.min(30, 5 + mass * 0.35);
      return {
        type: 'Hypernova / GRB (Collapsar)',
        category: 'Relativistic Jet Core Collapse',
        remnant: `Spinning Black Hole (${bhMass.toFixed(1)} M☉) & Relativistic Jets`,
        remnantType: 'blackhole',
        remnantMass: bhMass,
        badge: '🚀 HYPERNOVA / GRB',
        description: 'Rapid rotation forms a magnetar or accretion disk around a newly formed black hole, launching extreme relativistic Gamma-Ray Burst jets and a 10x energy hypernova.'
      };
    }

    // 10 - 25 Solar Masses: Standard Core Collapse (Type II)
    if (mass >= 10.0 && mass < 25.0) {
      const nsMass = Math.min(2.1, 1.3 + (mass - 10) * 0.05);
      return {
        type: 'Type II Core Collapse Supernova',
        category: 'Iron Core Collapse',
        remnant: `Neutron Star / Pulsar (${nsMass.toFixed(2)} M☉)`,
        remnantType: 'neutronstar',
        remnantMass: nsMass,
        badge: '💥 TYPE II SUPERNOVA',
        description: 'Silicon fusion creates an Iron core. Iron cannot fuse exothermically, causing catastrophic gravitational core collapse, neutrino shockwave revival, and a bright Type II Supernova leaving a Pulsar.'
      };
    }

    // 25 - 40 Solar Masses: Stripped Envelope (Type Ib/Ic) -> Black Hole
    if (mass >= 25.0 && mass < 40.0) {
      const bhMass = Math.min(15, 3 + mass * 0.25);
      return {
        type: 'Type Ib/Ic Supernova (Stripped Envelope)',
        category: 'Wolf-Rayet Core Collapse',
        remnant: `Stellar Black Hole (${bhMass.toFixed(1)} M☉)`,
        remnantType: 'blackhole',
        remnantMass: bhMass,
        badge: '💥 TYPE Ib/Ic SUPERNOVA',
        description: 'Stellar winds or binary mass transfer stripped the outer Hydrogen/Helium envelope. The bare helium/carbon core collapses into a stellar-mass Black Hole.'
      };
    }

    // 40 - 130 Solar Masses: Fallback Core Collapse / Failed Supernova
    if (mass >= 40.0 && mass < 130.0) {
      if (metallicity < 0.2) {
        // Direct collapse with minimal shock
        const bhMass = mass * 0.6;
        return {
          type: 'Failed Supernova (Direct Black Hole Collapse)',
          category: 'Unrevived Shock Collapse',
          remnant: `Massive Black Hole (${bhMass.toFixed(1)} M☉)`,
          remnantType: 'blackhole',
          remnantMass: bhMass,
          badge: '⚫ FAILED SUPERNOVA',
          description: 'The massive star core collapses into a Black Hole. The shock wave fails to explode the heavy envelope, causing the entire star to vanish into the event horizon with only a weak optical transient.'
        };
      } else {
        const bhMass = Math.min(35, 10 + mass * 0.3);
        return {
          type: 'Type Ic Core Collapse with Fallback',
          category: 'High-Mass Core Collapse',
          remnant: `Intermediate Black Hole (${bhMass.toFixed(1)} M☉)`,
          remnantType: 'blackhole',
          remnantMass: bhMass,
          badge: '💥 TYPE Ic FALLBACK SN',
          description: 'Powerful explosion occurs, but strong gravitational pull causes substantial ejected material to fall back onto the central core, growing a Black Hole.'
        };
      }
    }

    // 130 - 250 Solar Masses: Pair-Instability Supernova (PISN)
    if (mass >= 130.0 && mass <= 250.0) {
      return {
        type: 'Pair-Instability Supernova (PISN)',
        category: 'Thermonuclear Pair Creation Runaway',
        remnant: 'No Remnant Left (Total Thermonuclear Annihilation)',
        remnantType: 'none',
        remnantMass: 0,
        badge: '💥 PAIR-INSTABILITY SN',
        description: 'High-energy gamma rays in the oxygen core spontaneously convert into electron-positron pairs, dropping thermal pressure. The core contracts violently, igniting runaway oxygen/silicon fusion that completely destroys the star with NO REMNANT left behind!'
      };
    }

    // > 250 Solar Masses: Photodisintegration Collapse
    const bhMass = mass * 0.8;
    return {
      type: 'Photodisintegration Supernova',
      category: 'Hypermassive Core Collapse',
      remnant: `Intermediate-Mass Black Hole (${bhMass.toFixed(0)} M☉)`,
      remnantType: 'blackhole',
      remnantMass: bhMass,
      badge: '⚫ PHOTODISINTEGRATION',
      description: 'The core becomes so hot that gamma-ray photons destroy iron nuclei into alpha particles, absorbing heat and triggering instantaneous collapse into an Intermediate-Mass Black Hole.'
    };
  }

  /**
   * Generate Onion Shell Structure for 3D View & Inspector
   */
  static generateFusionShells(mass, fateType) {
    if (fateType.includes('Type Ia')) {
      return [
        { name: 'Degenerate Carbon-Oxygen Core', element: 'C / O', temp: '100,000,000 K', color: '#00f0ff', radiusFrac: 0.4 },
        { name: 'Accreting Hydrogen/Helium Shell', element: 'H / He', temp: '15,000,000 K', color: '#ffaa00', radiusFrac: 1.0 }
      ];
    }

    if (mass < 8) {
      return [
        { name: 'Inert Carbon-Oxygen Core', element: 'C / O', temp: '200,000,000 K', color: '#00ffff', radiusFrac: 0.25 },
        { name: 'Helium Burning Shell', element: 'He', temp: '100,000,000 K', color: '#ffcc00', radiusFrac: 0.55 },
        { name: 'Hydrogen Outer Envelope', element: 'H', temp: '15,000,000 K', color: '#ff4444', radiusFrac: 1.0 }
      ];
    }

    // Massive Star Full Onion Shell Structure
    return [
      { name: 'Inert Iron-Nickel Core', element: 'Fe / Ni', temp: '3,000,000,000 K', color: '#888888', radiusFrac: 0.12, fusionTime: '1 Day' },
      { name: 'Silicon Fusion Shell', element: 'Si / S', temp: '2,000,000,000 K', color: '#ffaa00', radiusFrac: 0.22, fusionTime: '1 Week' },
      { name: 'Oxygen Fusion Shell', element: 'O / Mg', temp: '1,500,000,000 K', color: '#00f0ff', radiusFrac: 0.35, fusionTime: '6 Months' },
      { name: 'Neon Fusion Shell', element: 'Ne / O', temp: '1,200,000,000 K', color: '#ff00aa', radiusFrac: 0.48, fusionTime: '1 Year' },
      { name: 'Carbon Fusion Shell', element: 'C / O', temp: '800,000,000 K', color: '#aa00ff', radiusFrac: 0.62, fusionTime: '600 Years' },
      { name: 'Helium Fusion Shell', element: 'He / N', temp: '200,000,000 K', color: '#ffff00', radiusFrac: 0.78, fusionTime: '1,000,000 Years' },
      { name: 'Hydrogen Envelope', element: 'H', temp: '40,000,000 K', color: '#ff3333', radiusFrac: 1.0, fusionTime: '10,000,000 Years' }
    ];
  }

  /**
   * Calculate Nucleosynthesis Ejected Heavy Elements (Solar Masses)
   */
  static calculateNucleosynthesis(mass, fateType) {
    if (fateType.includes('Type Ia')) {
      return {
        ironNi: 0.6,
        silicon: 0.3,
        oxygen: 0.15,
        rProcessGoldPt: 0.001,
        description: 'Type Ia produces massive amounts of radioactive Nickel-56 which decays into Iron, enriching the universe with iron-group elements.'
      };
    }

    if (fateType.includes('Pair-Instability')) {
      return {
        ironNi: Math.round(mass * 0.25 * 10) / 10,
        silicon: Math.round(mass * 0.35 * 10) / 10,
        oxygen: Math.round(mass * 0.25 * 10) / 10,
        rProcessGoldPt: Math.round(mass * 0.005 * 100) / 100,
        description: 'PISN synthesizes enormous quantities of Oxygen, Silicon, and Iron, dispersing the entire star into interstellar space.'
      };
    }

    const ejecta = Math.max(1, mass - 2);
    return {
      ironNi: Math.round((0.05 + ejecta * 0.03) * 100) / 100,
      silicon: Math.round((0.2 + ejecta * 0.08) * 10) / 10,
      oxygen: Math.round((0.5 + ejecta * 0.2) * 10) / 10,
      rProcessGoldPt: Math.round((0.0001 + ejecta * 0.0002) * 10000) / 10000,
      description: 'Core collapse supernovae seed interstellar clouds with Oxygen, Silicon, Calcium, and r-process heavy elements like Gold, Platinum, and Uranium.'
    };
  }

  /**
   * Generate Simulated Light Curve Data Points
   */
  static generateLightCurve(type, energyBethes, ejectaMass) {
    const points = [];
    const peakDays = type.includes('Type Ia') ? 18 : 25;
    const maxMag = -19.0 - (energyBethes * 0.5);

    for (let day = 0; day <= 120; day += 4) {
      let mag;
      if (day < peakDays) {
        // Brightening phase
        const ratio = day / peakDays;
        mag = -10.0 + (maxMag + 10.0) * Math.sin((ratio * Math.PI) / 2);
      } else {
        // Decay phase (radioactive Cobalt-56 decay slope ~0.01 mag/day)
        const daysAfterPeak = day - peakDays;
        let decayRate = 0.012;
        if (type.includes('Type II-P') && daysAfterPeak > 20 && daysAfterPeak < 90) {
          decayRate = 0.002; // Hydrogen recombination plateau
        }
        mag = maxMag + (daysAfterPeak * decayRate);
      }
      points.push({ day, magnitude: Math.min(-6, mag) });
    }

    return points;
  }
}

window.AstrophysicsEngine = AstrophysicsEngine;
