// Génère les sons qui manquent aux packs Kenney avec Stable Audio Open, via l'API de ComfyUI (port 8188).
// node tools/sons/generate.mjs [nom...]   écrit 4 variantes par son dans tools/sons/brut/<nom>_<n>.flac
// Ensuite : node tools/sons/finish.mjs <nom>_<n> ... choisit, coupe, normalise et copie dans www/sons.

import { mkdirSync, writeFileSync } from "node:fs";

const COMFY = process.env.COMFY ?? "http://localhost:8188";
const NEG = "music, melody, singing, speech, voice, talking, low quality, distorted, reverb tail, hiss";
// pour les musiques : pas de voix, pas de batterie qui cogne, rien de criard
const NEG_MUSIC = "speech, voice, singing, vocals, drums, drum kit, electronic beat, harsh, distorted, low quality, noise, abrupt ending";

// chaque son : le texte, la durée générée, la graine de départ
export const SOUNDS = {
  // ---- les sorts et les gardiens
  "cast-fire": { text: "fireball launch, a burst of flame whooshing away from the hand, roaring fire swoosh, fantasy spell foley", seconds: 2 },
  "boom-fire": { text: "fiery explosion impact, heavy fire blast with crackling debris, deep and punchy, fantasy game sound effect", seconds: 3 },
  "cast-holy": { text: "holy spell cast, bright shimmering choir-less magical swell rising, sparkling light energy, fantasy game sound effect", seconds: 2 },
  "smite": { text: "lightning strike of holy light, sharp thunder crack with a bright magical shimmer, close impact, fantasy sound effect", seconds: 2.5 },
  "heal": { text: "healing magic, soft warm shimmering sparkles rising, gentle magical whoosh, fantasy game sound effect", seconds: 2.5 },
  "shield": { text: "magic barrier forming, a resonant humming shield of light closing around, glassy shimmer, fantasy sound effect", seconds: 2.5 },
  "dash": { text: "fast armored dash, a heavy whoosh of wind and clinking chainmail rushing past, foley", seconds: 1.5 },
  "quake": { text: "heavy ground slam, earth shaking impact with rumbling stones and crumbling rocks, deep thud, foley", seconds: 3 },
  "ice": { text: "ice magic, crystals forming and shattering, frosty crackle and sharp glassy chime, fantasy sound effect", seconds: 2 },
  "boss-wake": { text: "dark monster awakening, deep ominous rumbling roar with metal armor clanking, menacing, cinematic sound effect", seconds: 3 },
  "boss-fall": { text: "powerful dark creature defeated, a deep dying roar fading into a dark magical implosion and silence, cinematic", seconds: 4 },
  // ---- les musiques : des boucles d'ambiance d'environ 30 s, sans voix ni batterie
  "mus-remparts": { music: true, text: "calm medieval fantasy night ambience music, lute and soft strings, slow melancholic melody, castle ramparts, loopable game music", seconds: 32 },
  "mus-foret": { music: true, text: "mystical enchanted forest ambient music, soft harp and flute, gentle wonder, fireflies at night, loopable fantasy game music", seconds: 32 },
  "mus-mines": { music: true, text: "dark underground cave ambient music, deep drones, distant dripping, sparse crystal bell tones, mysterious, loopable game music", seconds: 32 },
  "mus-marais": { music: true, text: "eerie swamp ambient music, low murky drones, slow plucked strings, rain atmosphere, uneasy and damp, loopable game music", seconds: 32 },
  "mus-cathedrale": { music: true, text: "solemn sunken cathedral ambient music, slow pipe organ and ethereal pads, reverent and sad, loopable fantasy game music", seconds: 32 },
  "mus-citadelle": { music: true, text: "ominous dark fantasy citadel music, low brass and tense strings, slow dread, storm atmosphere, loopable game music", seconds: 32 },
  "mus-boss": { music: true, text: "intense epic fantasy boss battle music, driving low strings and brass, urgent rhythm, heroic and dangerous, loopable game music", seconds: 32 },
  "mus-carte": { music: true, text: "peaceful medieval fantasy map theme, warm lute and recorder, hopeful gentle melody, loopable game music", seconds: 32 },
  // le souffle de l'épée, deuxième essai : plusieurs descriptions, l'oreille choisit (www/ecoute.html)
  "swing-a": { text: "a single sword swing whoosh, heavy steel blade cutting through the air, smooth swoosh about half a second long, close microphone, clean foley", seconds: 2 },
  "swing-b": { text: "fast blade swish, air whoosh of a sword slash, crisp and airy, no impact, game sound effect", seconds: 2 },
  "swing-c": { text: "medieval longsword swung hard, deep whooshing air, foley recording, dry, single swing", seconds: 2 },
  "swing-d": { text: "whoosh swish sound effect, quick movement through air, cinematic sword swipe, short", seconds: 2 },
  "swing-e": { text: "sword slash with metallic ring, blade whoosh followed by a short steel shing, fantasy game", seconds: 2 },
  swing: { text: "sword swing whoosh, a single fast blade swooshing through the air, close up, dry foley sound effect", seconds: 1.5 },
  ignite: { text: "large brazier igniting, a whoosh of flames bursting into a roaring fire, fire burst foley sound effect", seconds: 3 },
  "fire-loop": { text: "crackling wood fire in an iron brazier, steady flames, pops and crackles, close, field recording", seconds: 12 },
  ember: { text: "tiny fire spark pickup, a soft short crackle with a small magical shimmer, game sound effect", seconds: 1 },
  splat: { text: "wet slime splat, gooey squelch as a slime monster bursts, juicy foley sound effect", seconds: 1.5 },
};

function workflow(text, seconds, seed, prefix, neg = NEG, batch = 4) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "stable_audio_open_1.0.safetensors" } },
    2: { class_type: "CLIPLoader", inputs: { clip_name: "t5_base.safetensors", type: "stable_audio" } },
    3: { class_type: "CLIPTextEncode", inputs: { text, clip: ["2", 0] } },
    4: { class_type: "CLIPTextEncode", inputs: { text: neg, clip: ["2", 0] } },
    5: { class_type: "ConditioningStableAudio", inputs: { positive: ["3", 0], negative: ["4", 0], seconds_start: 0, seconds_total: seconds } },
    6: { class_type: "EmptyLatentAudio", inputs: { seconds, batch_size: batch } },
    7: { class_type: "KSampler", inputs: { seed, steps: 60, cfg: 6, sampler_name: "dpmpp_3m_sde_gpu", scheduler: "exponential", denoise: 1, model: ["1", 0], positive: ["5", 0], negative: ["5", 1], latent_image: ["6", 0] } },
    8: { class_type: "VAEDecodeAudio", inputs: { samples: ["7", 0], vae: ["1", 2] } },
    9: { class_type: "SaveAudio", inputs: { audio: ["8", 0], filename_prefix: `brasier/${prefix}` } },
  };
}

async function run(name) {
  const s = SOUNDS[name];
  const r = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow(s.text, s.seconds, 1000 + name.length * 77, name, s.music ? NEG_MUSIC : NEG, s.music ? 3 : 4) }) });
  const { prompt_id, error, node_errors } = await r.json();
  if (!prompt_id) throw new Error(`${name} : ${JSON.stringify(error ?? node_errors)}`);
  for (;;) {
    await new Promise((ok) => setTimeout(ok, 1500));
    const h = (await (await fetch(`${COMFY}/history/${prompt_id}`)).json())[prompt_id];
    if (!h) continue;
    if (h.status?.status_str === "error") throw new Error(`${name} : échec de la génération`);
    const files = h.outputs?.["9"]?.audio;
    if (!files) continue;
    mkdirSync("tools/sons/brut", { recursive: true });
    let i = 0;
    for (const f of files) {
      const q = new URLSearchParams({ filename: f.filename, subfolder: f.subfolder, type: f.type });
      const buf = Buffer.from(await (await fetch(`${COMFY}/view?${q}`)).arrayBuffer());
      writeFileSync(`tools/sons/brut/${name}_${i++}.flac`, buf);
    }
    console.log(`${name} : ${files.length} variantes`);
    return;
  }
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOUNDS);
for (const n of names) await run(n);
