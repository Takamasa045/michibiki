# Michibiki (Español)

> このファイルは README.md のサマリ翻訳です。最新情報は英語版 / 日本語版を参照してください。
> This file is a summary translation of README.md. Refer to the English / Japanese version for the latest details.

Michibiki es un enrutador de producción de video con IA. Convierte una solicitud en lenguaje natural en un `VideoSpec`, selecciona el motor de video más adecuado y crea un proyecto generado o una salida de render.

La versión actual admite generación y renderizado con Remotion, generación HTML/CSS/JS y renderizado MP4 local para HyperFrames, y generación `timeline.json` con previsualización MP4 local para Editframe. Remotion usa el modo `auto` por defecto: utiliza el Remotion Studio Monorepo cuando existe y, si no, crea un proyecto oficial standalone de Remotion dentro del trabajo. HyperFrames/Editframe renderizan con headless Chrome y ffmpeg.

## Funciones principales

- Generar `VideoSpec` desde un prompt en lenguaje natural
- Seleccionar automáticamente el motor de video y mostrar el ajuste relativo de Remotion / HyperFrames / Editframe
- Generar `selectionGuide`, `bestUse` y `featureHighlights`
- Crear proyectos Remotion mediante Monorepo o standalone oficial con modo auto
- Generar proyectos HTML/CSS/JS para HyperFrames y renderizar MP4
- Generar handoffs `timeline.json` para Editframe y renderizar previsualizaciones MP4
- Guardar resultados en `outputs/jobs/<job-id>`
- Mostrar avisos de licencia para motores externos

## Comandos básicos

```bash
pnpm install
pnpm build
pnpm test
pnpm michibiki create --prompt "Create a 30-second vertical event promo video."
pnpm michibiki doctor
pnpm michibiki preview --job outputs/jobs/<job-id>
pnpm michibiki generate --prompt "Create a 30-second vertical event promo video."
```

## Licencia

El código original de este repositorio está publicado bajo MIT License. Cada motor externo se rige por su propia licencia y sus términos oficiales.

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - términos y precios oficiales de Editframe

Antes de usarlo con fines comerciales, en equipo o como SaaS, revisa las condiciones oficiales de cada herramienta.
