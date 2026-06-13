import type { VideoSpec } from "@michibiki/video-spec";

// String/object emitters for the standalone official Remotion project that
// Michibiki scaffolds when no Remotion monorepo is available. Kept separate
// from the engine dispatch logic in remotion-engine.ts to keep that file
// focused on the VideoEngine contract.
//
// Note: buildStandalonePackageJson stays in remotion-engine.ts because it
// embeds the renovate-managed *_VERSION constants (renovate's customManager
// in renovate.json targets that file).

export function buildStandaloneTsConfig(): Record<string, unknown> {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true
    },
    include: ["src", "remotion.config.ts"]
  };
}

export function buildStandaloneRemotionConfig(): string {
  return [
    'import { Config } from "@remotion/cli/config";',
    "",
    'Config.setVideoImageFormat("jpeg");',
    'Config.setOverwriteOutput(true);',
    ""
  ].join("\n");
}

export function buildStandaloneEntry(): string {
  return [
    'import { registerRoot } from "remotion";',
    'import { RemotionRoot } from "./Root";',
    "",
    "registerRoot(RemotionRoot);",
    ""
  ].join("\n");
}

export function buildStandaloneRoot(
  spec: VideoSpec,
  metadata: { compositionId: string; durationInFrames: number }
): string {
  const scenes = (spec.content.scenes ?? []).map((scene) => ({
    label: `Scene ${scene.order}`,
    text: scene.text ?? scene.description
  }));
  const fallbackScenes =
    scenes.length > 0
      ? scenes
      : [
          {
            label: "Scene 1",
            text: spec.goal
          }
        ];

  return [
    'import { AbsoluteFill, Composition, interpolate, useCurrentFrame } from "remotion";',
    'import { videoSpec } from "./video-spec";',
    "",
    `const WIDTH = ${spec.format.width};`,
    `const HEIGHT = ${spec.format.height};`,
    `const FPS = ${spec.format.fps};`,
    `const DURATION = ${metadata.durationInFrames};`,
    `const CTA = ${JSON.stringify(spec.content.cta ?? spec.format.aspectRatio)};`,
    `const scenes = ${JSON.stringify(fallbackScenes, null, 2)} as const;`,
    "const fallbackScene = { label: \"Scene 1\", text: videoSpec.goal };",
    "",
    "function MainVideo() {",
    "  const frame = useCurrentFrame();",
    "  const progress = frame / Math.max(1, DURATION - 1);",
    "  const activeIndex = Math.min(",
    "    scenes.length - 1,",
    "    Math.floor(progress * scenes.length)",
    "  );",
    "  const activeScene = scenes[activeIndex] ?? fallbackScene;",
    "  const reveal = interpolate(frame, [0, Math.min(24, DURATION)], [0, 1], {",
    '    extrapolateRight: "clamp"',
    "  });",
    "  const slide = interpolate(progress, [0, 1], [24, -24]);",
    "",
    "  return (",
    "    <AbsoluteFill",
    "      style={{",
    '        background: "linear-gradient(135deg, #111827 0%, #2563eb 52%, #f8fafc 100%)",',
    '        color: "white",',
    '        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",',
    '        overflow: "hidden"',
    "      }}",
    "    >",
    "      <div",
    "        style={{",
    '          position: "absolute",',
    '          inset: "7%",',
    '          display: "flex",',
    '          flexDirection: "column",',
    '          justifyContent: "space-between",',
    "          opacity: reveal,",
    '          transform: `translateY(${(1 - reveal) * 24}px)`',
    "        }}",
    "      >",
    "        <div",
    "          style={{",
    '            fontSize: 24,',
    '            letterSpacing: 0,',
    '            opacity: 0.78,',
    '            textTransform: "uppercase"',
    "          }}",
    "        >",
    "          Michibiki / Standalone Remotion",
    "        </div>",
    "        <div>",
    "          <div",
    "            style={{",
    '              fontSize: Math.max(58, WIDTH * 0.055),',
    "              fontWeight: 800,",
    "              lineHeight: 0.95,",
    '              letterSpacing: 0,',
    "              maxWidth: WIDTH * 0.72",
    "            }}",
    "          >",
    "            {videoSpec.title}",
    "          </div>",
    "          <div",
    "            style={{",
    '              marginTop: 34,',
    '              fontSize: Math.max(30, WIDTH * 0.025),',
    '              lineHeight: 1.22,',
    "              maxWidth: WIDTH * 0.68,",
    "              opacity: 0.9,",
    '              transform: `translateX(${slide}px)`',
    "            }}",
    "          >",
    "            {activeScene.text}",
    "          </div>",
    "        </div>",
    "        <div",
    "          style={{",
    '            display: "flex",',
    '            alignItems: "center",',
    '            justifyContent: "space-between",',
    '            gap: 32,',
    '            fontSize: 28',
    "          }}",
    "        >",
    "          <span>{activeScene.label}</span>",
    "          <span>{CTA}</span>",
    "        </div>",
    "      </div>",
    "    </AbsoluteFill>",
    "  );",
    "}",
    "",
    "export function RemotionRoot() {",
    "  return (",
    "    <Composition",
    `      id=${JSON.stringify(metadata.compositionId)}`,
    "      component={MainVideo}",
    "      durationInFrames={DURATION}",
    "      fps={FPS}",
    "      width={WIDTH}",
    "      height={HEIGHT}",
    "    />",
    "  );",
    "}",
    ""
  ].join("\n");
}
