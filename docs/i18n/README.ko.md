# Michibiki (한국어)

> このファイルは README.md のサマリ翻訳です。最新情報は英語版 / 日本語版を参照してください。
> This file is a summary translation of README.md. Refer to the English / Japanese version for the latest details.

Michibiki는 자연어 영상 제작 요청을 `VideoSpec`으로 변환하고, Remotion / HyperFrames / Editframe 중 가장 적합한 영상 제작 엔진을 선택하는 AI 영상 제작 라우터입니다.

현재 버전은 Remotion 프로젝트 생성/렌더링, HyperFrames HTML/CSS/JS 생성과 로컬 MP4 렌더링, Editframe `timeline.json` 생성과 로컬 MP4 타임라인 프리뷰를 지원합니다. Remotion은 기본적으로 `auto` 모드로 실행됩니다. Remotion Studio Monorepo가 있으면 이를 사용하고, 없으면 작업 디렉터리에 standalone 공식 Remotion 프로젝트를 생성합니다. HyperFrames/Editframe은 headless Chrome과 ffmpeg로 렌더링합니다.

## 주요 기능

- 자연어 프롬프트에서 `VideoSpec` 생성
- Engine Router를 통한 엔진 선택과 Remotion / HyperFrames / Editframe 상대 적합도 출력
- `selectionGuide`, `bestUse`, `featureHighlights` 출력
- Remotion auto 모드로 Monorepo 또는 standalone 공식 프로젝트 생성
- HyperFrames HTML/CSS/JS 프로젝트 생성 및 MP4 렌더링
- Editframe timeline handoff 생성 및 MP4 타임라인 프리뷰 렌더링
- `outputs/projects/<slug>`에 결과 저장
- 외부 엔진 라이선스 안내 표시

## 설치

```bash
git clone https://github.com/Takamasa045/michibiki.git
cd michibiki
pnpm install
pnpm build
pnpm test
```

요구 사항: Node.js 20+, pnpm 9+, ffmpeg(HyperFrames / Editframe MP4 렌더링용), Chromium / Chrome (`michibiki doctor` 가 자동 감지).

## 기본 명령

```bash
pnpm michibiki doctor
pnpm michibiki decide --prompt "Create a 30-second vertical event promo video."
pnpm michibiki create --prompt "Create a 30-second vertical event promo video."
pnpm michibiki preview --job outputs/projects/<slug>
pnpm michibiki generate --prompt "Create a 30-second vertical event promo video."
```

## 라이선스 안내

이 저장소의 자체 작성 코드는 MIT License로 제공됩니다. 외부 엔진은 각각의 공식 라이선스와 이용 약관을 따릅니다.

- HyperFrames - Apache-2.0
- Remotion - Remotion License
- Editframe - Editframe 공식 약관 및 가격 정책

상업적 사용, 팀 사용, SaaS 사용 전에는 각 도구의 공식 라이선스 조건을 확인하세요.
