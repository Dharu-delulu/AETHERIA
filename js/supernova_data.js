/**
 * SUPERNOVA LAB - Real Supernovae Astronomical Database
 * Contains observational history, progenitor star characteristics, distance,
 * remnant structure, and telescope telemetry (Hubble, JWST, Chandra).
 */

const REAL_SUPERNOVAE_DB = [
  {
    id: 'casa',
    name: 'Cassiopeia A (Cas A)',
    constellation: 'Cassiopeia',
    distanceLightYears: '11,000 ly',
    type: 'Type IIb (Core Collapse)',
    progenitorName: 'Massive Supergiant (Red/Yellow stripped)',
    progenitorMass: '16 - 25 Solar Masses',
    progenitorRadius: '450 R☉',
    temp: '4,200 K',
    discoveredYear: 'c. 1680 (John Flamsteed cataloged 3 Cassiopeiae)',
    remnantType: 'Oxygen-Rich Remnant + Central Compact Object (Neutron Star)',
    remnantMass: '1.4 M☉ Neutron Star',
    expansionSpeed: '4,000 to 6,000 km/s',
    lightCurvePeak: '-16.5 Peak Absolute Mag',
    description: 'Cassiopeia A is one of the youngest known supernova remnants in the Milky Way. Observations reveal a complex, knotty shell of oxygen, sulfur, and neon expanding into interstellar space, with a central un-pulsed neutron star with a carbon atmosphere.',
    telemetry: {
      chandra: 'X-ray emissions highlight iron-rich inner ejecta jet outracing outer oxygen shells (spatial inversion).',
      jwst: 'NIRCam & MIRI reveal the "Green Monster" structure in the central cavity and delicate unshocked ejecta knots.',
      hubble: 'Optical filamentary knots showing high-velocity silicon and oxygen gas moving at 10 million mph.'
    },
    timeline: [
      { stage: 'Main Sequence', desc: 'A 20 M☉ star fuses hydrogen rapidly in its core for 10 million years.' },
      { stage: 'Stellar Evolution', desc: 'Expands into a Red Supergiant; binary stellar winds strip most of its hydrogen envelope.' },
      { stage: 'Core Collapse', desc: 'Iron core reaches 1.4 M☉ Chandrasekhar mass limit and collapses in ~0.2 seconds.' },
      { stage: 'Supernova Explosion', desc: 'Neutrino-driven shockwave blasts through stripped helium core, igniting nucleosynthesis.' },
      { stage: 'Expanding Ejecta', desc: 'Asymmetric explosion launches fast-moving iron and oxygen filaments out into space.' },
      { stage: 'Modern Remnant', desc: 'Observed today by Chandra, JWST, and Hubble as an expanding 10-light-year bright nebular shell.' }
    ],
    starParams: {
      mass: 20,
      temperature: 4200,
      rotation: 25,
      metallicity: 1.0,
      composition: 'Oxygen-rich Stripped Core',
      isBinary: true,
      companionMass: 3.5
    }
  },
  {
    id: 'sn1987a',
    name: 'SN 1987A',
    constellation: 'Dorado (Large Magellanic Cloud)',
    distanceLightYears: '168,000 ly',
    type: 'Type II-P (Core Collapse)',
    progenitorName: 'Sanduleak -69° 202 (Blue Supergiant)',
    progenitorMass: '18 - 20 Solar Masses',
    progenitorRadius: '45 R☉',
    temp: '16,000 K',
    discoveredYear: '1987 (Ian Shelton & Oscar Duhalde)',
    remnantType: 'Triple Ring Nebula + Central Compact Object',
    remnantMass: '1.45 M☉ Neutron Star (JWST emission confirmed)',
    expansionSpeed: '7,000 to 10,000 km/s',
    lightCurvePeak: '-15.5 Peak Absolute Mag',
    description: 'SN 1987A was the closest observed supernova since Kepler\'s SN 1604. It surprised astronomers because the progenitor was a Blue Supergiant rather than a Red Supergiant. A burst of 24 neutrinos was detected 2-3 hours before light arrived!',
    telemetry: {
      chandra: 'X-ray ring spots brightening as the primary shockwave collides with dense equatorial circumstellar gas ring.',
      jwst: 'NIRSpec confirmed Argon and Sulfur emission lines directly originating from a newly born central Neutron Star.',
      hubble: 'Iconic hour-glass triple ring system illuminated by initial ultraviolet supernova flash.'
    },
    timeline: [
      { stage: 'Main Sequence', desc: '20 M☉ star in the low-metallicity Large Magellanic Cloud.' },
      { stage: 'Stellar Evolution', desc: 'Binary merger 20,000 years prior produced a compact Blue Supergiant surrounded by 3 gas rings.' },
      { stage: 'Core Collapse', desc: 'Feb 23, 1987: Iron core collapses into a neutron star, releasing 99% of energy in neutrinos.' },
      { stage: 'Supernova Explosion', desc: 'Shockwave travels through blue supergiant envelope in 2 hours, bursting into optical view.' },
      { stage: 'Expanding Ejecta', desc: 'Ejecta debris expands inside the glowing circumstellar equatorial ring.' },
      { stage: 'Modern Remnant', desc: 'JWST and Hubble track shock collisions with the outer ring forming glowing pearls of light.' }
    ],
    starParams: {
      mass: 19,
      temperature: 16000,
      rotation: 50,
      metallicity: 0.3,
      composition: 'Blue Supergiant Envelope',
      isBinary: true,
      companionMass: 6.0
    }
  },
  {
    id: 'crab',
    name: 'Crab Nebula (SN 1054)',
    constellation: 'Taurus',
    distanceLightYears: '6,500 ly',
    type: 'Type II (Electron Capture / Core Collapse)',
    progenitorName: 'Moderate Mass Supergiant',
    progenitorMass: '9 - 11 Solar Masses',
    progenitorRadius: '300 R☉',
    temp: '4,000 K',
    discoveredYear: '1054 AD (Recorded by Chinese, Japanese & Arab astronomers)',
    remnantType: 'Pulsar Wind Nebula + Crab Pulsar',
    remnantMass: '1.4 M☉ Pulsar (Rotates 30 times/second)',
    expansionSpeed: '1,500 km/s',
    lightCurvePeak: '-18.0 Peak Absolute Mag (Visible in daylight for 23 days)',
    description: 'The Crab Nebula is the prototypical Pulsar Wind Nebula. At its heart lies the Crab Pulsar, a highly magnetic neutron star spinning 30 times a second, powering bright synchrotron radiation across all wavelengths.',
    telemetry: {
      chandra: 'X-ray jets and dynamic ring wisp structures emanating from the high-energy pulsar wind.',
      jwst: 'Detailed infrared filaments of ionized nickel, iron, and dust grains formed in the explosion.',
      hubble: 'Complex web of glowing gas filaments expanding into space.'
    },
    timeline: [
      { stage: 'Main Sequence', desc: '10 M☉ star burns nuclear fuel for ~30 million years.' },
      { stage: 'Stellar Evolution', desc: 'Develops a degenerate O-Ne-Mg core surrounded by a swollen red hydrogen envelope.' },
      { stage: 'Core Collapse', desc: 'Electron capture triggers collapse into a magnetized Neutron Star.' },
      { stage: 'Supernova Explosion', desc: 'Bright explosion visible in daylight worldwide in July 1054 AD.' },
      { stage: 'Expanding Ejecta', desc: 'Relativistic particles from the spinning pulsar inject energy into surrounding ejecta.' },
      { stage: 'Modern Remnant', desc: 'A 11-light-year wide Pulsar Wind Nebula powered by a rapidly pulsing 30Hz neutron star.' }
    ],
    starParams: {
      mass: 10,
      temperature: 4000,
      rotation: 65,
      metallicity: 1.0,
      composition: 'Hydrogen/Helium Shell',
      isBinary: false,
      companionMass: 0
    }
  },
  {
    id: 'tycho',
    name: "Tycho's Supernova (SN 1572)",
    constellation: 'Cassiopeia',
    distanceLightYears: '8,000 ly',
    type: 'Type Ia (Thermonuclear Explosion)',
    progenitorName: 'Carbon-Oxygen White Dwarf',
    progenitorMass: '1.4 M☉ (Chandrasekhar Limit)',
    progenitorRadius: '0.01 R☉ (Earth-sized)',
    temp: '100,000 K',
    discoveredYear: '1572 AD (Tycho Brahe)',
    remnantType: 'Thermonuclear Remnant Shell (NO Central Compact Object!)',
    remnantMass: '0 M☉ (Star completely destroyed)',
    expansionSpeed: '5,000 to 9,000 km/s',
    lightCurvePeak: '-19.0 Peak Absolute Mag (Brighter than Venus)',
    description: 'Observed by Tycho Brahe in 1572, this event proved that the heavens beyond the Moon were not unchangeable. As a Type Ia thermonuclear supernova, the white dwarf was completely obliterated, leaving NO central neutron star or black hole behind.',
    telemetry: {
      chandra: 'Spherical shockwave with high-energy electron acceleration producing X-ray synchrotron emission.',
      jwst: 'Thermal dust emission from shock-heated interstellar grains.',
      hubble: 'Faint optical shock front filaments colliding with interstellar medium.'
    },
    timeline: [
      { stage: 'Main Sequence', desc: 'Binary system where one star evolved into a Carbon-Oxygen White Dwarf.' },
      { stage: 'Stellar Evolution', desc: 'White dwarf accretes hydrogen/helium gas from companion star until hitting 1.4 M☉.' },
      { stage: 'Thermonuclear Ignition', desc: 'Carbon fusion ignites degenerately in core, sending flame front through star.' },
      { stage: 'Supernova Explosion', desc: 'Star undergoes total thermonuclear disruption with 1.3 Bethes of explosive energy.' },
      { stage: 'Expanding Ejecta', desc: 'Iron and silicon debris blast outward at 9,000 km/s into surrounding space.' },
      { stage: 'Modern Remnant', desc: 'Expanding spherical bubble of heavy elements with zero central remnant.' }
    ],
    starParams: {
      mass: 1.4,
      temperature: 100000,
      rotation: 10,
      metallicity: 1.0,
      composition: 'Carbon-Oxygen Degenerate Core',
      isBinary: true,
      companionMass: 1.2
    }
  },
  {
    id: 'kepler',
    name: "Kepler's Supernova (SN 1604)",
    constellation: 'Ophiuchus',
    distanceLightYears: '20,000 ly',
    type: 'Type Ia (Thermonuclear Explosion)',
    progenitorName: 'White Dwarf in Binary System',
    progenitorMass: '1.4 M☉',
    progenitorRadius: '0.01 R☉',
    temp: '90,000 K',
    discoveredYear: '1604 AD (Johannes Kepler)',
    remnantType: 'Asymmetric Thermonuclear Ejecta Shell',
    remnantMass: '0 M☉ (Completely disrupted)',
    expansionSpeed: '6,000 km/s',
    lightCurvePeak: '-19.3 Peak Absolute Mag',
    description: 'Kepler\'s Supernova was the last supernova observed within the Milky Way galaxy in recorded history. Johannes Kepler studied it for over a year. The remnant shows strong interaction with asymmetric circumstellar gas.',
    telemetry: {
      chandra: 'Bright knotty X-ray emission indicating high iron and silicon abundances.',
      jwst: 'Mid-infrared dust filaments heated by forward shockwave.',
      hubble: 'Dense gas knots compressed by outward expanding supernova debris.'
    },
    timeline: [
      { stage: 'Main Sequence', desc: 'Intermediate mass star evolves into dense white dwarf.' },
      { stage: 'Stellar Evolution', desc: 'Companion star ejects wind gas before white dwarf reaches runaway fusion threshold.' },
      { stage: 'Thermonuclear Ignition', desc: 'Full-star carbon/silicon detonation.' },
      { stage: 'Supernova Explosion', desc: 'Observed by Johannes Kepler in October 1604, remaining visible for 18 months.' },
      { stage: 'Expanding Ejecta', desc: 'Ejecta collides with dense circumstellar cloud lost by companion.' },
      { stage: 'Modern Remnant', desc: 'Multiwavelength shell expanding through Ophiuchus gas cloud.' }
    ],
    starParams: {
      mass: 1.4,
      temperature: 90000,
      rotation: 15,
      metallicity: 1.0,
      composition: 'Carbon/Oxygen White Dwarf',
      isBinary: true,
      companionMass: 2.0
    }
  }
];

window.REAL_SUPERNOVAE_DB = REAL_SUPERNOVAE_DB;
