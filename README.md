# Marble Race 구슬 추첨기

구슬을 굴려 당첨자를 뽑는 추첨기입니다. 이름을 넣고 시작하면 물리 엔진으로
구슬들이 코스를 굴러 내려가고, 도착 순서대로 순위가 정해집니다.

## 개발

```shell
npm install
npm run dev     # http://localhost:1235
```

> `npm run build`를 돌린 뒤에 `npm run dev`를 쓸 때는 `rm -rf .parcel-cache`를
> 먼저 하세요. 빌드가 남긴 캐시 때문에 dev 서버가 자원 경로를 `/marble-race/`로
> 잡아서 화면이 깨집니다.

## 빌드 / 배포

```shell
npm run build   # dist/ 에 정적 파일 생성
```

`main` 브랜치에 push하면 GitHub Actions가 빌드해서 `gh-pages` 브랜치로 배포합니다.
저장소 Settings → Pages에서 Source를 `gh-pages` 브랜치로 지정하세요.

**저장소 이름은 `marble-race`여야 합니다.** `package.json`의 빌드 명령에
`--public-url /marble-race/`가 들어 있어서 GitHub Pages의 서브경로와 맞아야
자원이 로드됩니다. 다른 이름을 쓰려면 그 값을 같이 바꾸세요.

Cloudflare Pages나 Netlify처럼 루트 경로로 서빙하는 곳에 올린다면
`--public-url /`로 바꿔야 합니다.

## 기반

이 프로젝트는 lazygyu의 [Marble Roulette](https://github.com/lazygyu/roulette)을
포크해 만들었습니다. 원본 코드는 MIT 라이선스이며, 이 저장소도 같은 라이선스를
따릅니다. `LICENSE` 파일의 원저작권 고지는 MIT 조건에 따라 유지되어야 합니다.

**"Marble Roulette"™ / "마블 룰렛"™ 은 lazygyu의 상표입니다.** MIT 라이선스는
소스 코드에만 적용되며 해당 명칭에는 적용되지 않습니다. 그래서 이 포크는
다른 이름을 씁니다. 이름을 또 바꾸실 때도 원본 상표나 혼동을 줄 수 있는
유사 명칭은 피하세요.

### 원본에서 덜어낸 것

원작자 계정·인프라에 묶여 있던 코드를 제거했습니다.

- umami / Google Analytics 분석 스크립트
- 광고 시스템 (`adService`) — 원작자 서버(`marblerouletteshop.com`)에 의존
- 상점 버튼과 공지 모달
- 키워드 스프라이트 기능 — 외부 API 인증이 필요해 비활성화
- 서비스워커 (`scripts/build-sw.js`) — 원작자 사이트의 옛 서비스워커를
  회수하는 kill switch였고, 캐시 삭제 필터가 `images` 같은 전역 이름을 포함해
  같은 origin의 다른 프로젝트 캐시까지 지울 수 있어 제거했습니다.

## 구슬 스킨

기본 이름 목록은 암호화폐 티커 30개이고, 각 구슬에는 해당 코인 로고가 입혀집니다.
구슬 이름이 `assets/images/coins/`의 파일명(확장자 제외)과 **정확히 일치**하면
그 이미지를 스킨으로 씁니다. 등록은 `src/rouletteRenderer.ts`의 `_load()`에
있습니다.

이미지를 추가하려면 파일을 넣고 `_load()`에 한 줄 추가하세요.

```ts
{ name: 'BTC', imgUrl: new URL('../assets/images/coins/BTC.png', import.meta.url) },
```

경로는 Parcel이 정적으로 분석하므로 **문자열 리터럴로 써야** 합니다. 변수로
조립하면 번들에 포함되지 않아 이미지가 깨집니다.

외부 URL을 직접 쓰지 마세요. canvas가 오염(tainted)되어 녹화 기능이 깨집니다.
반드시 로컬 파일로 두어야 합니다.

로고는 [CoinGecko](https://www.coingecko.com)에서 받았습니다. 각 로고는 해당
프로젝트의 상표이며, 여기서는 그 코인을 지칭하는 용도로만 씁니다.

## 라이선스

[MIT](./LICENSE)
