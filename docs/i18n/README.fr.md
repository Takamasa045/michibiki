# Michibiki (Français)

> このファイルは README.md のサマリ翻訳です。最新情報は英語版 / 日本語版を参照してください。
> This file is a summary translation of README.md. Refer to the English / Japanese version for the latest details.

Michibiki est un routeur de production vidéo basé sur l'IA. Il transforme une demande en langage naturel en `VideoSpec`, choisit le moteur vidéo le plus adapté, puis crée un projet généré ou une sortie de rendu.

La version actuelle prend en charge la génération et le rendu Remotion, la génération HTML/CSS/JS et le rendu MP4 local pour HyperFrames, ainsi que la génération `timeline.json` avec aperçu MP4 local pour Editframe. Remotion utilise le mode `auto` par défaut: il utilise le Remotion Studio Monorepo s'il existe, sinon il crée un projet officiel standalone Remotion dans le dossier du job. HyperFrames/Editframe rendent via headless Chrome et ffmpeg.

## Fonctionnalités principales

- Générer un `VideoSpec` à partir d'un prompt en langage naturel
- Sélectionner automatiquement le moteur vidéo et afficher l'adéquation relative de Remotion / HyperFrames / Editframe
- Générer `selectionGuide`, `bestUse` et `featureHighlights`
- Créer des projets Remotion via Monorepo ou standalone officiel en mode auto
- Générer des projets HTML/CSS/JS pour HyperFrames et rendre en MP4
- Générer des handoffs `timeline.json` pour Editframe et rendre des aperçus MP4
- Enregistrer les résultats dans `outputs/jobs/<job-id>`
- Afficher les avertissements de licence pour les moteurs externes

## Installation

```bash
git clone https://github.com/Takamasa045/michibiki.git
cd michibiki
pnpm install
pnpm build
pnpm test
```

Prérequis : Node.js 20+, pnpm 9+, ffmpeg (pour le rendu MP4 HyperFrames / Editframe), Chromium / Chrome (détectés automatiquement par `michibiki doctor`).

## Commandes de base

```bash
pnpm michibiki doctor
pnpm michibiki decide --prompt "Create a 30-second vertical event promo video."
pnpm michibiki create --prompt "Create a 30-second vertical event promo video."
pnpm michibiki preview --job outputs/jobs/<job-id>
pnpm michibiki generate --prompt "Create a 30-second vertical event promo video."
```

## Licence

Le code original de ce dépôt est publié sous MIT License. Chaque moteur externe reste soumis à sa propre licence et à ses conditions officielles.

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - conditions et tarifs officiels d'Editframe

Avant une utilisation commerciale, en équipe ou en SaaS, vérifiez les conditions officielles de chaque outil.
