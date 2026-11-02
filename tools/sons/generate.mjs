// Génère les sons qui manquent aux packs Kenney avec Stable Audio Open, via l'API de ComfyUI (port 8188).
// node tools/sons/generate.mjs [nom...]   écrit 4 variantes par son dans tools/sons/brut/<nom>_<n>.flac
// Ensuite : node tools/sons/finish.mjs <nom>_<n> ... choisit, coupe, normalise et copie dans www/sons.

import { mkdirSync, writeFileSync } from "node:fs";

const COMFY = process.env.COMFY ?? "http://localhost:8188";
const NEG = "music, melody, singing, speech, voice, talking, low quality, distorted, reverb tail, hiss";

// chaque son : le texte, la durée générée, la graine de départ
export const SOUNDS = {
  swing: { text: "sword swing whoosh, a single fast blade swooshing through the air, close up, dry foley sound effect", seconds: 1.5 },
  ignite: { text: "large brazier igniting, a whoosh of flames bursting into a roaring fire, fire burst foley sound effect", seconds: 3 },
  "fire-loop": { text: "crackling wood fire in an iron brazier, steady flames, pops and crackles, close, field recording", seconds: 12 },
  ember: { text: "tiny fire spark pickup, a soft short crackle with a small magical shimmer, game sound effect", seconds: 1 },
  splat: { text: "wet slime splat, gooey squelch as a slime monster bursts, juicy foley sound effect", seconds: 1.5 },
};

function workflow(text, seconds, seed, prefix) {
  return {
    1: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "stable_audio_open_1.0.safetensors" } },
    2: { class_type: "CLIPLoader", inputs: { clip_name: "t5_base.safetensors", type: "stable_audio" } },
    3: { class_type: "CLIPTextEncode", inputs: { text, clip: ["2", 0] } },
    4: { class_type: "CLIPTextEncode", inputs: { text: NEG, clip: ["2", 0] } },
    5: { class_type: "ConditioningStableAudio", inputs: { positive: ["3", 0], negative: ["4", 0], seconds_start: 0, seconds_total: seconds } },
    6: { class_type: "EmptyLatentAudio", inputs: { seconds, batch_size: 4 } },
    7: { class_type: "KSampler", inputs: { seed, steps: 60, cfg: 6, sampler_name: "dpmpp_3m_sde_gpu", scheduler: "exponential", denoise: 1, model: ["1", 0], positive: ["5", 0], negative: ["5", 1], latent_image: ["6", 0] } },
    8: { class_type: "VAEDecodeAudio", inputs: { samples: ["7", 0], vae: ["1", 2] } },
    9: { class_type: "SaveAudio", inputs: { audio: ["8", 0], filename_prefix: `brasier/${prefix}` } },
  };
}

async function run(name) {
  const s = SOUNDS[name];
  const r = await fetch(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow(s.text, s.seconds, 1000 + name.length * 77, name) }) });
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
